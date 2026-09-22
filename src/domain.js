// 读取并检查项目共享的领域资料。
export function parseDomain(raw) {
  const value = JSON.parse(raw);
  const required = [
    'domain',
    'version',
    'sample_id',
    'actors',
    'facts',
    'constraints',
    'processes',
    'scenarios',
    'invariants',
    'reports',
  ];
  for (const key of required) {
    if (value[key] === undefined || value[key] === null) {
      throw new Error(`共享资料缺少必要字段: ${key}`);
    }
  }
  if (!nonEmptyString(value.domain) || !nonEmptyString(value.sample_id)) {
    throw new Error('共享资料的领域标识与样例标识不能为空');
  }
  if (!Number.isInteger(value.version) || value.version < 1) {
    throw new Error('共享资料版本必须为正整数');
  }
  for (const key of ['actors', 'facts', 'constraints', 'invariants', 'reports']) {
    if (!Array.isArray(value[key]) || value[key].some((item) => !nonEmptyString(item))) {
      throw new Error(`共享资料字段 ${key} 必须为非空字符串数组`);
    }
  }
  if (value.actors.length < 2 || value.facts.length < 2 || value.constraints.length < 2) {
    throw new Error('共享资料的参与方、事实与约束至少各包含两项');
  }
  validateProcesses(value.processes);
  validateScenarios(value.scenarios);
  return value;
}

function nonEmptyString(item) {
  return typeof item === 'string' && item.trim().length > 0;
}

function validateProcesses(processes) {
  if (!Array.isArray(processes) || processes.length === 0) {
    throw new Error('共享资料至少要包含一个状态机流程');
  }
  for (const process of processes) {
    if (!nonEmptyString(process.id) || !nonEmptyString(process.name)) {
      throw new Error('状态机流程缺少标识或名称');
    }
    if (!Array.isArray(process.states) || process.states.length < 2) {
      throw new Error(`状态机 ${process.id} 至少需要两个状态`);
    }
    if (new Set(process.states).size !== process.states.length) {
      throw new Error(`状态机 ${process.id} 存在重复状态`);
    }
    if (!Array.isArray(process.transitions) || process.transitions.length === 0) {
      throw new Error(`状态机 ${process.id} 至少需要一条流转`);
    }
    for (const transition of process.transitions) {
      for (const endpoint of ['from', 'to']) {
        if (!process.states.includes(transition[endpoint])) {
          throw new Error(`状态机 ${process.id} 的流转引用了未声明状态: ${transition[endpoint]}`);
        }
      }
      if (!nonEmptyString(transition.on)) {
        throw new Error(`状态机 ${process.id} 的流转缺少触发条件`);
      }
    }
  }
}

function validateScenarios(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length < 3) {
    throw new Error('共享资料至少要覆盖退赛、活动缩短、换摊三个异常场景');
  }
  const seen = new Set();
  for (const scenario of scenarios) {
    if (!nonEmptyString(scenario.id) || !nonEmptyString(scenario.trigger)) {
      throw new Error('异常场景缺少标识或触发条件');
    }
    if (seen.has(scenario.id)) {
      throw new Error(`异常场景标识重复: ${scenario.id}`);
    }
    seen.add(scenario.id);
    const routing = scenario.refund_routing;
    if (!routing || !nonEmptyString(routing.self_paid) || !nonEmptyString(routing.subsidy)) {
      throw new Error(`异常场景 ${scenario.id} 必须同时说明自付与补贴两条退款去向`);
    }
  }
}
