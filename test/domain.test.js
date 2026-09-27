import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseDomain } from '../src/domain.js';

async function loadFixture() {
  const raw = await readFile(new URL('../fixtures/domain.json', import.meta.url), 'utf8');
  return parseDomain(raw);
}

test('样例领域标识与版本正确', async () => {
  const value = await loadFixture();
  assert.equal(value.domain, 'race-rural-settlement');
  assert.ok(value.version >= 2);
});

test('同一链路覆盖参赛人到补贴资金', async () => {
  const value = await loadFixture();
  const ids = value.ledger_chain.map((link) => link.id);
  for (const expected of [
    'registration',
    'voucher',
    'merchant_stall',
    'product_batch',
    'redemption',
    'tourism_service',
    'refund',
    'subsidy_ledger',
  ]) {
    assert.ok(ids.includes(expected), `链路缺少环节 ${expected}`);
  }
});

test('三类异常情形都明确了规则与承担方', async () => {
  const value = await loadFixture();
  const scenarios = Object.fromEntries(value.scenarios.map((s) => [s.id, s]));
  for (const id of ['runner_withdraw', 'weather_shortened', 'stall_change']) {
    assert.ok(scenarios[id], `缺少异常情形 ${id}`);
    assert.ok(scenarios[id].rule.includes('退') || scenarios[id].bearer.includes('退'));
  }
});

test('防重复补贴控制齐备', async () => {
  const value = await loadFixture();
  const ids = value.controls.map((control) => control.id);
  for (const expected of [
    'server_side_credential',
    'single_redemption_concurrency',
    'idempotent_request',
    'split_allocation',
    'partial_refund_clawback',
  ]) {
    assert.ok(ids.includes(expected), `控制缺少 ${expected}`);
  }
});

test('商户隔离与游客当场查询都在可见范围规则内', async () => {
  const value = await loadFixture();
  const ids = value.access_rules.map((rule) => rule.id);
  assert.ok(ids.includes('visitor_on_site_query'));
  assert.ok(ids.includes('merchant_isolation'));
});

test('财政四问均有对账口径', async () => {
  const value = await loadFixture();
  const questions = value.reports.map((report) => report.question).join('\n');
  for (const keyword of ['承担', '新增销售', '复购', '尚未履约']) {
    assert.ok(questions.includes(keyword), `报表缺少关于 ${keyword} 的口径`);
  }
});

test('缺少关键控制时校验失败', () => {
  const broken = JSON.stringify({
    domain: 'race-rural-settlement',
    version: 2,
    sample_id: 'x',
    event: '测试赛',
    actors: ['运营方', '商户'],
    facts: ['a', 'b'],
    constraints: ['a', 'b'],
    ledger_chain: Array.from({ length: 6 }, (_, i) => ({
      id: `link${i}`,
      name: '环节',
      desc: 'x',
    })),
    scenarios: [{ id: 'other', name: 'x', trigger: 'x', rule: 'x', bearer: 'x' }],
    controls: [
      { id: 'server_side_credential', rule: 'x' },
      { id: 'single_redemption_concurrency', rule: 'x' },
      { id: 'idempotent_request', rule: 'x' },
      { id: 'split_allocation', rule: 'x' },
      { id: 'partial_refund_clawback', rule: 'x' },
      { id: 'refund_links_credential', rule: 'x' },
    ],
    access_rules: [{ id: 'visitor_on_site_query', rule: 'x' }],
    reports: [{ id: 'r1', question: 'q', basis: 'b' }],
  });
  assert.throws(() => parseDomain(broken), /runner_withdraw/);
});
