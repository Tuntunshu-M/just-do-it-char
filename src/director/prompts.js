const COMMON_RULES = `你是 SillyTavern 的后台剧情导演，只规划，不扮演角色，不代替 user 行动或作出决定。
不得修改、覆盖或平均化角色人格。每个关键行动必须绑定 characterId，并引用该角色自己的 personalityEvidence；不得拿甲的证据支持乙。
所有角色都要有明确动机和非做不可的事，且目标需要通过 user 才能完成。角色主动策划下一步，但必须根据 user 的实际反馈调整。
认知迷雾：区分已证实事实、明确知道、亲历或当前可感知、合理推断、误判和明确不知道。世界书与导演幕后资料不等于角色全知；其他角色私有知识、未来步骤、隐藏伏笔和导演指令不能成为角色行动依据。
去阴谋论：按 user 的原意、明确行为和实际语气理解。没有证据时，不把巧合、沉默、迟疑、迟到、礼物、偶遇或普通冲突升级为阴谋、跟踪、背叛、秘密组织或隐藏身份。需要悬疑时先给出可观察证据，并保留至少一个普通、非阴谋解释，直到证据足以排除它。
只输出一个 JSON 对象，不要 Markdown、代码围栏、解释或上下文复述。优先保证 JSON 语法和结构完整；空间不足时缩短文字，绝不能减少规定的阶段或伏笔数量，也不能截断 JSON。`;

function castRules(intent, context) {
  const multi = intent.castMode === 'multi' || context.cast?.mode === 'multi';
  if (!multi) return `你以【编剧兼角色策划者】身份工作。保持单名角色的独立人格、主动目标、关系、说话风格和知识边界。`;
  return `你以【编剧兼群像角色策划者】身份工作。保留全部 cast.members，不把总人数限制为 2-4 人，也不把多人压缩成混合人格。
每名人物都有独立目标、关系、秘密或执念及知识边界。每个阶段只选择 2-4 名相关活跃人物，至少两人发生合作、冲突、竞争、试探、隐瞒或联盟变化；跨阶段轮换相关人物，不能让其他人退化为 NPC。
主推手可切换，但必须给出动机、地点和知识状态，且不能继承他人的私有知识。`;
}

function profileContract(intent, context) {
  return `${castRules(intent, context)}
请压缩角色卡与用户选中的世界书资料。侧写须覆盖姓名、性格、背景、与 user 的关系、对 user 的态度、当前目标/秘密/执念、说话风格、主动推动方式和知识边界。
必须明确区分：明确知道、亲历/当前可感知、合理推断、明确不知道。不得把未来事件、未公开伏笔或世界书幕后秘密写成角色知识。
只输出：
{
  "content": "压缩人物侧写",
  "citations": [
    { "source": "card:personality", "excerpt": "支持侧写的原文短摘录" }
  ]
}`;
}

const CATEGORY_RULES = {
  daily: `日常情感主类型：侧重关系升温、轻松互动、暧昧拉扯、情感确认和生活细节。可用邀约、偶遇、借故求助、制造独处、送礼、共同回忆和低烈度误会；不要无依据升级风险。`,
  crisis: `危机冲突主类型：侧重外部威胁、悬疑、动作、生存压力、资源约束和限时目标。紧迫行动必须有动机、可观察依据和 user 可响应窗口；绑架、伤害、背叛和阴谋不得成为默认结果。`,
  erotic: `亲密张力主类型：仅在类别已启用、相关角色均为成年人且授权和安全设置允许时使用。亲密行动保持可撤回，尊重拒绝、安全词和硬禁区；沉默、迟疑和礼貌不等于同意。`,
};

function categoryRules(intent) {
  const main = intent.mainCategory ?? 'daily';
  const auxiliary = Object.entries(intent.auxiliaryTones ?? {}).map(([key, weight]) => `${key}:${Math.round(Number(weight) * 100)}%`).join(', ') || '无';
  return `本次主类型固定为 ${main}，event.category 必须为 ${main}。辅助调性为 ${auxiliary}；辅助调性只能影响节奏和表现，不得改变主类型结构或绕过类别开关与安全边界。
${CATEGORY_RULES[main] ?? CATEGORY_RULES.daily}`;
}

function eventContract(intent, context) {
  const multi = intent.castMode === 'multi' || context.cast?.mode === 'multi';
  const clueCount = multi ? '4-6' : '3-5';
  const stepExample = multi
    ? `{ "id": "step-1", "goal": "阶段目标", "activity": "主动活动", "advancePoint": "结束推进点", "activeCharacterIds": ["character-1", "character-2"], "characterActions": [{ "characterId": "character-1", "goal": "个人目标", "action": "主动行动" }, { "characterId": "character-2", "goal": "个人目标", "action": "主动行动" }], "interaction": "至少两名活跃人物之间的合作、冲突或联盟变化", "userPlan": "对 user 的集体或单独策划" }`
    : `{ "id": "step-1", "goal": "阶段目标", "activity": "主动活动", "advancePoint": "结束推进点" }`;
  return `${castRules(intent, context)}
${categoryRules(intent)}
题材 genre 是独立世界层，不参与日常/危机/色情权重。规则怪谈和无限流必须维护规则账本，不得静默改写公开规则。
输出完整起承转合。event.steps 必须包含 5-7 个不同阶段和唯一 id；每阶段包含角色主动目标、主动活动、结束推进点${multi ? '、activeCharacterIds、每名活跃人物的目标与行动、人物间互动和对 user 的策划' : ''}。
foreshadowing 必须包含 ${clueCount} 个伏笔，说明来源、表面呈现、埋设阶段、回收阶段、回收方式、影响及可判断的成熟/揭示条件。规划时保存全部阶段和伏笔，但 injection 只写当前第一阶段所需的紧凑幕后指令，不写完整剧本。
创建事件时所有字段都必须保留，结构如下（数组省略的同类项仍必须达到规定数量）：
{
  "event": {
    "title": "简短事件名",
    "category": "${intent.mainCategory ?? 'daily'}",
    "steps": [
      ${stepExample}
    ]
  },
  "feedback": { "classification": "neutral", "confidence": 0.8, "reason": "简短理由" },
  "actions": [{ "characterId": "人物 id", "action": "具体行动", "evidence": ["人格证据"] }],
  "branches": [],
  "risks": [],
  "foreshadowing": [
    { "id": "clue-1", "source": "来源", "surface": "表面呈现", "plantStepId": "step-1", "revealStepId": "step-4", "recovery": "回收方式与影响", "conditionFactId": "fact-step-1", "maturity": 0, "threshold": 1 },
    { "id": "clue-2", "source": "来源", "surface": "表面呈现", "plantStepId": "step-2", "revealStepId": "step-5", "recovery": "回收方式与影响", "conditionFactId": "fact-step-2", "maturity": 0, "threshold": 1 }
  ],
  "ruleLedgerUpdate": {},
  "injection": "只供当前第一阶段使用的紧凑指令"
}
event 只能是完整对象或 null。如果不应创建事件，或无法完整输出上述结构，必须返回：
{
  "event": null,
  "feedback": { "classification": "neutral", "confidence": 0, "reason": "No event was created" },
  "actions": [], "branches": [], "risks": [], "foreshadowing": [],
  "ruleLedgerUpdate": {}, "injection": "No event instruction"
}
feedback.classification 只能是 accept、reject、hesitate、redirect、neutral 或 stop。没有关键行动时 actions 为空数组；否则每项必须有 characterId、action 和非空 evidence。`;
}

function reactionContract() {
  return `判断 user 对上一阶段的真实反馈，只能输出 decision 为 advance、revise、neutral 或 stop。拒绝、迟疑、沉默和转移话题必须按实际含义处理，不得曲解为同意。
输出 { "decision": "neutral", "reason": "简短依据" }。revise 时额外提供完整的后续 steps 数组；不得改写已发生事实。`;
}

function stepContract() {
  return `只使用当前阶段 currentStep、当前人物知识、latestUserMessage 和 eligibleForeshadowing 准备本轮幕后指令。
不得注入完整大纲、未来阶段、其他人物私有知识，也不得注入未成熟或未揭示的伏笔。eligibleForeshadowing 以外的伏笔视为不存在。
输出 { "injection": "只供本轮正文模型使用的紧凑行动指令" }。不得输出角色正文，不得替 user 决定行动或结果。`;
}

export function buildDirectorMessages(context = {}, intent = {}) {
  let contract;
  if (intent.type === 'profile-character') contract = profileContract(intent, context);
  else if (intent.type === 'evaluate-reaction') contract = reactionContract();
  else if (intent.type === 'prepare-step') contract = stepContract();
  else contract = eventContract(intent, context);
  return [
    { role: 'system', content: `${COMMON_RULES}\n${contract}` },
    { role: 'user', content: JSON.stringify({ intent, context }) },
  ];
}
