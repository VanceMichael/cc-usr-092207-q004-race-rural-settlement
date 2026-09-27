// 读取并检查项目共享的领域资料。

const REQUIRED_SECTIONS = [
  'actors',
  'facts',
  'constraints',
  'ledger_chain',
  'scenarios',
  'controls',
  'access_rules',
  'reports',
];

// 防重复补贴的关键控制，缺少任何一项都视为资料不完整。
const REQUIRED_CONTROLS = [
  'server_side_credential',
  'single_redemption_concurrency',
  'idempotent_request',
  'split_allocation',
  'partial_refund_clawback',
  'refund_links_credential',
];

// 三类必须事先约定承担方与退款去向的异常情形。
const REQUIRED_SCENARIOS = [
  'runner_withdraw',
  'weather_shortened',
  'stall_change',
];

const STRING_FIELDS = ['domain', 'sample_id', 'event'];

function fail(message) {
  throw new Error(`共享资料校验失败：${message}`);
}

function hasStrings(value, key, min) {
  if (!Array.isArray(value[key]) || value[key].length < min) {
    fail(`${key} 至少需要 ${min} 项`);
  }
  if (value[key].some((item) => typeof item !== 'string' || item.length === 0)) {
    fail(`${key} 中每一项都必须是非空字符串`);
  }
}

function checkRecords(section, records, requiredKeys) {
  if (!Array.isArray(records) || records.length === 0) {
    fail(`${section} 必须是非空数组`);
  }
  const ids = new Set();
  records.forEach((record, index) => {
    if (typeof record !== 'object' || record === null) {
      fail(`${section}[${index}] 必须是对象`);
    }
    for (const key of requiredKeys) {
      if (typeof record[key] !== 'string' || record[key].length === 0) {
        fail(`${section}[${index}] 缺少非空字段 ${key}`);
      }
    }
    if (ids.has(record.id)) {
      fail(`${section} 中存在重复 id：${record.id}`);
    }
    ids.add(record.id);
  });
  return ids;
}

export function parseDomain(raw) {
  const value = JSON.parse(raw);

  for (const field of STRING_FIELDS) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      fail(`缺少非空字段 ${field}`);
    }
  }
  if (!Number.isInteger(value.version) || value.version < 2) {
    fail('version 必须是不小于 2 的整数');
  }

  hasStrings(value, 'actors', 2);
  hasStrings(value, 'facts', 2);
  hasStrings(value, 'constraints', 2);

  checkRecords('ledger_chain', value.ledger_chain, ['id', 'name', 'desc']);
  if (value.ledger_chain.length < 6) {
    fail('ledger_chain 至少需要覆盖 6 个链路环节');
  }
  const scenarioIds = checkRecords('scenarios', value.scenarios, [
    'id',
    'name',
    'trigger',
    'rule',
    'bearer',
  ]);
  const controlIds = checkRecords('controls', value.controls, ['id', 'rule']);
  checkRecords('access_rules', value.access_rules, ['id', 'rule']);
  checkRecords('reports', value.reports, ['id', 'question', 'basis']);

  for (const id of REQUIRED_SCENARIOS) {
    if (!scenarioIds.has(id)) {
      fail(`scenarios 缺少异常情形 ${id}`);
    }
  }
  for (const id of REQUIRED_CONTROLS) {
    if (!controlIds.has(id)) {
      fail(`controls 缺少关键防重控制 ${id}`);
    }
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!Array.isArray(value[section])) {
      fail(`${section} 必须是数组`);
    }
  }

  return value;
}
