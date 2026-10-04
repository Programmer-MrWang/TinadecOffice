import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptsDir, "..");
const rootDir = resolve(desktopDir, "..", "..");

/// What a .deb has to contain before anyone is asked to install it.
///
/// This does not install anything: `ar` and `tar` read the archive the way a package manager would,
/// and the assertions are about the relationships inside it. Naming is deliberately not hard-coded —
/// electron-builder picks the desktop-file name and install directory — so the checks are "does the
/// thing the launcher points at exist", which survives a packager rename and still catches a
/// shipped-broken package.
export function inspectDeb({ control, desktopEntries, dataEntries, desktopFile, version }) {
	const problems = [];
	const fields = parseControlFields(control);

	const required = ["Package", "Version", "Maintainer", "Architecture", "Description"];
	for (const field of required) {
		if (!fields[field]) problems.push(`control has no '${field}'`);
	}
	if (fields.Version && version && !fields.Version.startsWith(version)) {
		problems.push(`control Version '${fields.Version}' does not carry the app version '${version}'`);
	}
	if (fields.Maintainer && !fields.Maintainer.includes("@")) {
		problems.push(`Maintainer '${fields.Maintainer}' has no address`);
	}
	if (fields.Architecture && fields.Architecture !== "amd64") {
		problems.push(`Architecture is '${fields.Architecture}', expected amd64 for linux-x64`);
	}

	const executables = dataEntries.filter((entry) => /^\.?\/opt\/[^/]+\/[^/]+$/.test(entry) && !entry.endsWith("/"));
	if (executables.length === 0) problems.push("no executable installed under /opt/<Product>/");

	const desktops = dataEntries.filter((entry) => entry.endsWith(".desktop"));
	if (desktops.length === 0) problems.push("no .desktop entry, so the app will not appear in any launcher");

	if (desktopFile) {
		// A .desktop file is `Key=value`, not the `Key: value` of a control member — reading it with
		// the control parser finds no keys and every check below silently passes on nothing.
		const parsed = parseDesktopKeys(desktopFile);
		const exec = parsed.Exec;
		if (!exec) {
			problems.push("the .desktop file has no Exec key");
		} else {
			// data.tar lists "./opt/TinadecOffice/TinadecOffice" while Exec says
			// "/opt/TinadecOffice/TinadecOffice %U": compare the same shape or every package looks
			// broken.
			const wanted = exec.split(/\s+/)[0].replace(/^\.?\/+/, "");
			const installed = executables.map((entry) => entry.replace(/^\.?\/+/, ""));
			if (!installed.some((entry) => entry === wanted || entry.endsWith(`/${wanted}`))) {
				problems.push(`.desktop Exec '${exec}' does not name any installed binary (${installed.join(", ") || "none"})`);
			}
		}
		const icon = parsed.Icon;
		if (!icon) {
			problems.push("the .desktop file has no Icon key — the launcher would show a generic tile");
		} else if (!dataEntries.some((entry) => /icons\/.*\//.test(entry) && entry.includes(icon))) {
			problems.push(`.desktop Icon '${icon}' matches no icon in the archive`);
		}
	}

	if (desktopEntries.length === 0) {
		// electron-builder always ships maintainer scripts alongside control; reading a control.tar
		// that holds only "control" means the member was picked wrong, not that the package is odd.
		problems.push("control.tar holds nothing but 'control' — the archive was probably read from the wrong member");
	}
	return problems;
}

export function parseControlFields(text) {
	const fields = {};
	for (const line of (text ?? "").split(/\r?\n/)) {
		const match = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/.exec(line);
		if (match) fields[match[1]] = match[2].trim();
	}
	return fields;
}

export function parseDesktopKeys(text) {
	const keys = {};
	for (const line of (text ?? "").split(/\r?\n/)) {
		const match = /^([A-Za-z][A-Za-z0-9-]*)=(.*)$/.exec(line.trim());
		if (match) keys[match[1]] = match[2].trim();
	}
	return keys;
}

function run(command, args, cwd) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
	}
	return result.stdout;
}

function newestDeb(releaseDir) {
	if (!existsSync(releaseDir)) return null;
	const debs = readdirSync(releaseDir).filter((name) => name.endsWith("-linux-x64.deb")).sort();
	return debs.length ? join(releaseDir, debs.at(-1)) : null;
}

export function readDeb(archive) {
	const work = mkdtempSync(join(tmpdir(), "tinadec-deb-"));
	try {
		run("ar", ["x", resolve(archive)], work);
		const parts = readdirSync(work);
		const controlTar = parts.find((name) => name.startsWith("control.tar"));
		const dataTar = parts.find((name) => name.startsWith("data.tar"));
		if (!controlTar || !dataTar) {
			throw new Error(`ar produced no control/data member (got ${parts.join(", ") || "nothing"})`);
		}
		const controlEntries = run("tar", ["tf", controlTar], work).split(/\r?\n/).filter(Boolean);
		const control = run("tar", ["xOf", controlTar, "./control"], work);
		const dataEntries = run("tar", ["tf", dataTar], work).split(/\r?\n/).filter(Boolean);
		// The launcher entry is payload, not metadata: it lives in data.tar under
		// usr/share/applications. Looking for it in control.tar finds nothing and the whole desktop
		// check then passes by having nothing to say.
		const desktopName = dataEntries.find((entry) => entry.endsWith(".desktop"));
		const desktopFile = desktopName ? run("tar", ["xOf", dataTar, desktopName], work) : "";
		return { control, controlEntries, dataEntries, desktopFile };
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const version = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8")).version;
	const releaseDir = join(desktopDir, "release");
	const archive = process.argv[2] ?? newestDeb(releaseDir);
	if (!archive || !existsSync(archive)) {
		console.error(`No .deb to inspect (looked in ${releaseDir}).`);
		process.exit(1);
	}
	const { control, controlEntries, dataEntries, desktopFile } = readDeb(archive);
	const problems = inspectDeb({
		control,
		desktopFile,
		dataEntries,
		desktopEntries: controlEntries.filter((entry) => entry !== "./control" && !entry.endsWith("/")),
		version,
	});
	if (problems.length > 0) {
		console.error(`${archive} is not installable as shipped:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
		console.error(`data entries seen: ${dataEntries.length}; control entries: ${controlEntries.join(", ")}`);
		process.exit(1);
	}
	console.log(`${archive}: control, launcher, binary and icon all agree (${dataEntries.length} files).`);
}
