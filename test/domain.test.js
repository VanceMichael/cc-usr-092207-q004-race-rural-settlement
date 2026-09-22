import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDomain } from '../src/domain.js';

async function loadFixture() {
  const raw = await readFile(new URL('../fixtures/domain.json', import.meta.url), 'utf8');
  return parseDomain(raw);
}

test('样例领域标识正确', async () => {
  const value = await loadFixture();
  assert.equal(value.domain, 'race-rural-settlement');
  assert.ok(value.constraints.length >= 2);
});

test('三类异常场景都说明自付与补贴退款去向', async () => {
  const value = await loadFixture();
  const ids = value.scenarios.map((scenario) => scenario.id);
  assert.deepEqual(ids.sort(), ['merchant-relocation', 'runner-withdraw', 'weather-shortened']);
  for (const scenario of value.scenarios) {
    assert.match(scenario.refund_routing.self_paid, /退|改签|不产生/);
    assert.match(scenario.refund_routing.subsidy, /红冲|回补|作废|换券|不产生/);
  }
});

test('消费券状态机覆盖预占、核销与退款红冲', async () => {
  const value = await loadFixture();
  const voucher = value.processes.find((process) => process.id === 'voucher');
  assert.ok(voucher, '应存在消费券状态机');
  assert.deepEqual(voucher.states, ['issued', 'frozen', 'redeemed', 'released']);
  const edges = voucher.transitions.map(({ from, to }) => `${from}->${to}`);
  assert.ok(edges.includes('issued->frozen'));
  assert.ok(edges.includes('frozen->redeemed'));
  assert.ok(edges.includes('redeemed->released'));
});

test('防重复补贴与幂等是显式不变量', async () => {
  const value = await loadFixture();
  const joined = value.invariants.join('\n');
  assert.match(joined, /唯一/);
  assert.match(joined, /幂等/);
  assert.match(joined, /截图/);
});

test('成效报表覆盖新增销售、复购与未履约服务', async () => {
  const value = await loadFixture();
  const joined = value.reports.join('\n');
  assert.match(joined, /新增销售/);
  assert.match(joined, /复购/);
  assert.match(joined, /未履约/);
});

test('缺字段或状态机引用未声明状态时拒绝解析', () => {
  const valid = {
    domain: 'x',
    version: 1,
    sample_id: 's',
    actors: ['a', 'b'],
    facts: ['f1', 'f2'],
    constraints: ['c1', 'c2'],
    processes: [
      {
        id: 'p',
        name: '流程',
        states: ['s1', 's2'],
        transitions: [{ from: 's1', to: 's2', on: 'go' }],
      },
    ],
    scenarios: [
      { id: 'one', trigger: 't', refund_routing: { self_paid: '原路退', subsidy: '红冲' } },
      { id: 'two', trigger: 't', refund_routing: { self_paid: '原路退', subsidy: '红冲' } },
      { id: 'three', trigger: 't', refund_routing: { self_paid: '原路退', subsidy: '红冲' } },
    ],
    invariants: ['i'],
    reports: ['r'],
  };
  assert.equal(parseDomain(JSON.stringify(valid)).domain, 'x');
  assert.throws(() => parseDomain(JSON.stringify({ ...valid, reports: undefined })), /必要字段/);

  const broken = structuredClone(valid);
  broken.processes[0].transitions[0].to = 'missing';
  assert.throws(() => parseDomain(JSON.stringify(broken)), /未声明状态/);
});
