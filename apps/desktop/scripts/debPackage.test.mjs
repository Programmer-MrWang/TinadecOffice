import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { inspectDeb, parseDesktopKeys } from "./check-deb-package.mjs";

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(desktopDir, "package.json"), "utf8"));

const CONTROL = [
	"Package: tinadecoffice",
	"Version: 0.1.1",
	"Architecture: amd64",
	"Maintainer: Lincube <lincube3@hotmail.com>",
	"Depends: libgtk-3-0, libnss3",
	"Description: TinadecOffice desktop workbench",
	" An Electron shell over the Gateway and Core agent runtime.",
].join("\n");

const DESKTOP = [
	"[Desktop Entry]",
	"Name=TinadecOffice",
	"Exec=/opt/TinadecOffice/TinadecOffice %U",
	"Icon=tinadecoffice",
	"Type=Application",
	"StartupWMClass=TinadecOffice",
].join("\n");

const DATA = [
	"./opt/",
	"./opt/TinadecOffice/",
	"./opt/TinadecOffice/TinadecOffice",
	"./usr/share/applications/tinadecoffice.desktop",
	"./usr/share/icons/hicolor/512x512/apps/tinadecoffice.png",
];

const CONTROL_MEMBERS = ["./control", "./postinst", "./prerm"];

function check(overrides = {}) {
	return inspectDeb({
		control: CONTROL,
		desktopFile: DESKTOP,
		dataEntries: DATA,
		desktopEntries: CONTROL_MEMBERS.filter((entry) => entry !== "./control"),
		version: "0.1.1",
		...overrides,
	});
}

test("A deb whose launcher, binary and icon agree is accepted", () => {
	// This is also the case that fails if the .desktop file is read with the control parser: no
	// `Key: value` line exists in it, so Exec/Icon would be missing and the checks below would have
	// nothing to say.
	assert.deepEqual(check(), []);
	assert.equal(parseDesktopKeys(DESKTOP).Exec, "/opt/TinadecOffice/TinadecOffice %U");
});

test("A launcher pointing at a binary the package does not ship is refused", () => {
	const problems = check({
		desktopFile: DESKTOP.replace("Exec=/opt/TinadecOffice/TinadecOffice", "Exec=/opt/TinadecOffice/tinadec"),
	});

	assert.equal(problems.length, 1);
	assert.match(problems[0], /does not name any installed binary/);
});

test("An icon key with no icon in the archive is refused", () => {
	// The failure electron-builder produces without a large enough source: the package installs, the
	// launcher exists, and the app shows a generic tile forever.
	const problems = check({ dataEntries: DATA.filter((entry) => !entry.includes("icons")) });

	assert.equal(problems.length, 1);
	assert.match(problems[0], /Icon 'tinadecoffice' matches no icon/);
});

test("Package metadata the installer and the archive must agree on is checked", () => {
	assert.match(check({ version: "9.9.9" })[0], /does not carry the app version '9\.9\.9'/);
	assert.match(check({ control: CONTROL.replace(/Maintainer: .*/, "Maintainer: Lincube") })[0], /no address/);
	assert.match(check({ control: CONTROL.replace("amd64", "arm64") })[0], /expected amd64/);
	// A package with no installed binary is reported twice on purpose: the structure is wrong and so
	// is the launcher that points into it. Collapsing the two would hide one behind the other.
	assert.deepEqual(check({ dataEntries: DATA.filter((entry) => !entry.startsWith("./opt/")) }), [
		"no executable installed under /opt/<Product>/",
		".desktop Exec '/opt/TinadecOffice/TinadecOffice %U' does not name any installed binary (none)",
	]);
	assert.match(check({ desktopFile: "[Desktop Entry]\nName=TinadecOffice\n" })[0], /no Exec key/);
});

test("The checker is wired into the Linux leg and reads the archive, not a guess", () => {
	assert.match(pkg.scripts["check:deb"] ?? "", /node scripts\/check-deb-package\.mjs/);
	const workflow = readFileSync(resolve(desktopDir, "..", "..", ".github", "workflows", "desktop-release.yml"), "utf8");
	assert.match(workflow, /npm run check:deb -w @tinadec\/desktop/);
	const source = readFileSync(join(desktopDir, "scripts", "check-deb-package.mjs"), "utf8");
	assert.match(source, /\["xOf", dataTar, desktopName\]/, "the .desktop file must come out of data.tar");
	assert.equal(existsSync(join(desktopDir, "scripts", "check-deb-package.mjs")), true);
});
