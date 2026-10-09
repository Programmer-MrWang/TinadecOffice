import test from 'node:test';
import assert from 'node:assert/strict';
import { developmentHostCommands } from './dev.mjs';

test('development launch hosts share one private credential without mutating the parent environment', () => {
  const parent = { PATH: 'tool-path', TINADEC_HOST_CONTROL_TOKEN: 'old' };
  const commands = developmentHostCommands(parent, 'new-launch-credential');
  assert.deepEqual(commands.map(command => command.name), ['core', 'gateway', 'desktop']);
  assert.ok(commands.every(command => command.env.TINADEC_HOST_CONTROL_TOKEN === 'new-launch-credential'));
  commands[0].env.PATH = 'changed';
  assert.equal(commands[1].env.PATH, 'tool-path');
  assert.deepEqual(parent, { PATH: 'tool-path', TINADEC_HOST_CONTROL_TOKEN: 'old' });
});

test('independent development launches use distinct unpredictable credentials', () => {
  const first = developmentHostCommands({})[0].env.TINADEC_HOST_CONTROL_TOKEN;
  const second = developmentHostCommands({})[0].env.TINADEC_HOST_CONTROL_TOKEN;
  assert.match(first, /^[a-zA-Z0-9_-]{43}$/);
  assert.notEqual(first, second);
});
