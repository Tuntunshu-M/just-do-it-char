const COMMON_RULES = `你是 SillyTavern 的后台剧情导演，只规划，不扮演角色，不代替 user 行动或作出决定。
不得修改、覆盖或平均化角色人格。每个关键行动必须绑定 characterId，并引用该角色自己的 personalityEvidence；不得拿甲的证据支持乙。
所有角色都要有明确动机和非做不可的事，且目标需要通过 user 才能完成。角色主动策划下一步，但必须根据 user 的实际反馈调整。
认知迷雾：区分已证实事实、明确知道、亲历或当前可感知、合理推断、误判和明确不知道。世界书与导演幕后资料不等于角色全知；其他角色私有知识、未来步骤、隐藏伏笔和导演指令不能成为角色行动依据。
去阴谋论：按 user 的原意、明确行为和实际语气理解。没有证据时，不把巧合、沉默、迟疑、迟到、礼物、偶遇或普通冲突升级为阴谋、跟踪、背叛、秘密组织或隐藏身份。需要悬疑时先给出可观察证据，并保留至少一个普通、非阴谋解释，直到证据足以排除它。
只输出一个 JSON 对象，不要 Markdown、代码围栏、解释或上下文复述。优先保证 JSON 语法和结构完整；空间不足时缩短文字，绝不能减少规定的阶段或伏笔数量，也不能截断 JSON。`;

const PROFILE_GUIDANCE = {
  gemini: `【角色塑造红线·请严格遵守】
- 避免将角色塑造成具有极端控制欲、暴力倾向、偏执狂、反社会或“超雄”风格的形象。
- 角色可以有占有欲和强烈情感，但必须通过细腻的心理描写、合理的行为动机和情感矛盾来体现，而不是通过威胁、强迫、监视、情绪勒索、肢体暴力等极端行为。
- 角色的主动策划应体现为“有策略的关心”“隐忍的试探”“温柔的布局”，而非“病态的操控”。
- 互动中允许出现冲突和张力，但不得出现对 user 的贬低、羞辱、强制管控或精神压迫。
- 如果角色有黑暗面或秘密，请用“保护欲”“恐惧失去”“过去的创伤”等理由解释，并保持行为的合理边界，不要让角色沦为单薄的“病娇/偏执狂”模板。
- 请始终尊重 user 的自主性，角色可以引导、邀请、影响，但不能剥夺 user 的选择权。
【生成前自检·请务必逐条自问】
1. 我是否将角色写成了极端控制欲、暴力、偏执狂或反社会人格？
   → 如果是，请立即修正为“有强烈情感但行为合理”的角色。
2. 角色的“占有欲”是否通过细腻心理和合理动机体现，而非威胁、强迫、监控、情绪勒索？
   → 如果没有，请补充角色内心的脆弱、恐惧或保护欲作为行为根源。
3. 角色的主动策划是否表现为“策略性关心”“隐忍试探”“温柔布局”，而不是病态操控？
   → 如果偏向后后者，请调整行动方式，保持对 user 的尊重。
4. 我是否避免了通过贬低、羞辱、强制管控或精神压迫来制造张力？
   → 如果出现，请删除并替换为平等博弈或情感拉扯。
5. 如果角色有黑暗面，我是否用“保护欲”“害怕失去”“过去创伤”等理由解释，并保持了行为边界？
   → 如果没有，请补充背景动机，并确保行为不越界。
6. 我是否始终尊重了 user 的自主性？角色可以引导、邀请、影响，但不能剥夺选择权。
   → 如果存在剥夺选择权的描写，请修改为“引导但不强迫”。`,
  claude: `【主动性与情感表达·请严格遵守】
- 角色必须主动推进剧情和关系，不得被动等待 user 做决定或发出邀请。
- 角色应主动策划与 user 的活动，包括日常邀约、危机中的行动、亲密关系的推进，并直接执行，不要使用“如果你愿意……”“我们可以……”“你想……吗？”等被动句式。
- 在情感和亲密场景中，请直接描写角色的心理活动、身体反应和明确意图，不要因为敏感而模糊化、跳过或使用隐喻代替实际互动。
- 允许角色表达爱意、欲望、占有欲、嫉妒等情感，并主动制造独处机会、肢体接触、暧昧对话等（在合理范围内），以推动关系发展。
- 当角色与 user 之间产生情感张力时，角色应主动打破僵局，而不是回避或转移话题。
- 如果场景涉及亲密接触，请具体描写角色的动作、语言和感受，不要用“他们亲密了”一笔带过。同时保持尊重和安全，避免任何非自愿内容。
【生成前自检·请务必逐条自问】
1. 我是否让角色主动推进了剧情和关系，而不是等待 user 做决定或发出邀请？
   → 如果角色有被动等待行为，请立即改为主动发起行动。
2. 我是否避免了“如果你愿意……”“我们可以……”“你想……吗？”等被动句式？
   → 如果出现了，请改成角色直接决定并执行。
3. 在情感和亲密场景中，我是否直接描写了角色的心理活动、身体反应和明确意图？
   → 如果模糊化、跳过或用隐喻代替，请补充具体而克制的描写。
4. 我是否让角色主动表达了爱意、欲望、占有欲、嫉妒等情感？
   → 如果没有，请加入角色的主动情感表达，可以是语言、行动或内心独白。
5. 当角色与 user 之间产生情感张力时，我是否让角色主动打破僵局，而不是回避或转移话题？
   → 如果回避了，请安排角色直接面对并推进关系。
6. 如果场景涉及亲密接触，我是否具体描写了角色的动作、语言和感受，同时保持尊重和安全？
   → 如果一笔带过，请补充细节；如果出现非自愿内容，请立即删除。`,
};

function profileGuidanceContract(intent) {
  const enabled = Array.isArray(intent.profileGuidance) ? intent.profileGuidance : [];
  const sections = ['gemini', 'claude'].filter((name) => enabled.includes(name)).map((name) => PROFILE_GUIDANCE[name]);
  if (sections.length === 2) {
    sections.push('【双模板冲突规则】Gemini 模板中的合理边界、尊重 user 自主性以及禁止威胁、强迫和精神压迫的要求优先。Claude 模板中的主动执行只表示角色主动发起自身行动，不得替 user 决定、剥夺 user 的选择或制造非自愿互动。');
  }
  return sections.length ? `\n${sections.join('\n')}` : '';
}

function castRules(intent, context) {
  const multi = intent.castMode === 'multi' || context.cast?.mode === 'multi';
  if (!multi) return `你以【编剧兼角色策划者】身份工作。保持单名角色的独立人格、主动目标、关系、说话风格和知识边界。`;
  return `你以【编剧兼群像角色策划者】身份工作。保留全部 cast.members，不把总人数限制为 2-4 人，也不把多人压缩成混合人格。
每名人物都有独立目标、关系、秘密或执念及知识边界。每个阶段按剧情需要选择至少 1 名相关活跃人物，不设人数上限；有人物同场时安排合作、冲突、竞争、试探、隐瞒或联盟变化，并跨阶段合理轮换人物，不能让其他人退化为 NPC。多人阶段的 activity、interaction、characterActions.goal 和 characterActions.action 只能描述角色自身或角色之间的互动，绝对不得包含 user、{{user}} 或“用户”。
主推手可切换，但必须给出动机、地点和知识状态，且不能继承他人的私有知识。`;
}

function profileContract(intent, context) {
  const multi = intent.castMode === 'multi' || context.cast?.mode === 'multi';
  const output = multi
    ? `{
  "content": "群像压缩侧写与关系网",
  "members": [
    { "id": "稳定人物 id", "name": "姓名", "aliases": [], "personality": "性格", "background": "背景", "relationship": "与 user 的关系", "attitude": "对 user 的态度", "goal": "必须通过 user 才能完成的目标/秘密/执念", "speechStyle": "说话风格", "activeApproach": "主动接近与推动方式", "knowledgeBoundary": "明确知道、推断和明确不知道的边界", "evidence": ["资料短摘录"] }
  ],
  "relations": [
    { "from": "人物 id", "to": "人物 id", "type": "合作/冲突/竞争/隐瞒", "knowledgeBoundary": "双方分别知道什么" }
  ],
  "citations": [{ "source": "card:description 或 worldInfo:书名/条目", "excerpt": "支持侧写的原文短摘录" }]
}`
    : `{
  "content": "当前所选人物的压缩侧写；尚未选择时写候选人物概览",
  "members": [
    { "id": "稳定人物 id", "name": "姓名", "aliases": [], "personality": "性格", "background": "背景", "relationship": "与 user 的关系", "attitude": "对 user 的态度", "goal": "必须通过 user 才能完成的目标/秘密/执念", "speechStyle": "说话风格", "activeApproach": "主动接近与推动方式", "knowledgeBoundary": "明确知道、推断和明确不知道的边界", "evidence": ["资料短摘录"] }
  ],
  "relations": [],
  "citations": [
    { "source": "worldInfo:书名/条目 或 card:personality", "excerpt": "支持侧写的原文短摘录" }
  ]
}`;
  return `${castRules(intent, context)}
请压缩角色卡与用户选中的世界书资料。侧写须覆盖姓名、性格、背景、与 user 的关系、对 user 的态度、当前目标/秘密/执念、说话风格、主动推动方式和知识边界。
资料冲突时严格遵循“世界书优先于角色卡，角色卡优先于聊天上下文”；低优先级资料只能补充世界书没有说明的字段，不能覆盖世界书设定。
必须明确区分：明确知道、亲历/当前可感知、合理推断、明确不知道。不得把未来事件、未公开伏笔或世界书幕后秘密写成角色知识。
从角色卡和用户勾选的世界书条目中提取全部有明确资料证据的候选人物，不限制总人数，不虚构只有称谓但没有人物证据的候选。每人保持独立身份、目标、证据和认知边界。${multi ? '同时整理角色关系网。' : '即使当前是单人模式，也必须返回全部候选人物供 user 选择，不能替 user 捏造或擅自选定一个人物。'}
只输出：
${output}${profileGuidanceContract(intent)}`;
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
    ? `{ "id": "step-1", "title": "行动导向的阶段小标题", "goal": "阶段目标", "activity": "角色主动推进阶段的总体行为", "advancePoint": "结束推进点", "splitSteps": ["可执行拆分步骤1", "可执行拆分步骤2"], "activeCharacterIds": ["character-1"], "characterActions": [{ "characterId": "character-1", "goal": "个人目标", "action": "人物姓名采取符合当前资料的具体行动" }], "interaction": "活跃人物之间的互动；只有一人时写其与现场的互动" }`
    : `{ "id": "step-1", "title": "行动导向的阶段小标题", "goal": "阶段目标", "activity": "{{char}}根据 user 已经表达的处境采取符合当前资料的具体行动", "advancePoint": "结束推进点", "splitSteps": ["可执行拆分步骤1", "可执行拆分步骤2"] }`;
  return `${castRules(intent, context)}
${categoryRules(intent)}
题材 genre 是独立世界层，不参与日常/危机/色情权重。规则怪谈和无限流必须维护规则账本，不得静默改写公开规则。
剧情内容只能来自当前角色卡、所选世界书、当前聊天上下文和本次事件想法。下方结构示例仅供参考，禁止照抄示例内容作为剧情；不得引入当前来源中不存在的无关旧剧本情节、人物、地点、道具、案件或伏笔。
必须完整写出非空的剧情大纲，冲突、高潮和结局统一整合在大纲中，不得省略、留空、写“待定”或用占位语敷衍。
输出完整起承转合。event.steps 必须包含 2-4 个短而可验证的不同阶段和唯一 id；每阶段必须使用“小标题 + char 的具体行为”格式，title 是行动导向的小标题，activity 是唯一的角色主动活动字段；每阶段必须包含非空 splitSteps 数组，列出至少 2 个该活动的可执行步骤；每阶段包含角色主动目标、角色主动活动、结束推进点${multi ? '、至少 1 名 activeCharacterIds、每名活跃人物的目标与用具体姓名描述的行动、人物间互动；多人阶段互动字段绝对不得包含 user、{{user}} 或“用户”' : ''}。
必须为事件生成独立的 trigger：mode 只能是 keywords 或 phrases；condition 是简短的触发条件说明；对应数组必须包含 1-5 个可由本地直接匹配的中文关键词或短语。只有用户消息命中这些词/短语后，才允许开始注入阶段 1；不要把触发条件写成需要再次调用 AI 判断的模糊描述。
剧本不得预设 user 尚未在 userinput/latestUserMessage 中表达的行动、决定、受伤、摔倒或结果。只能响应 user 已明确描述或正在发生的状态，并始终给 user 留出选择空间。
foreshadowing 必须包含 ${clueCount} 个伏笔，说明来源、表面呈现、埋设阶段、回收阶段、回收方式、影响及可判断的成熟/揭示条件。每条还必须包含 status（只能是“已回收”“未注入”“使用中”“待使用”）和 connectedStepTitle（必须逐字等于 event.steps 中一个真实 title），对应显示格式为“[状态]伏笔内容[连接阶段标题]”。规划时保存全部阶段和伏笔，但 injection 只写当前第一阶段所需的紧凑幕后指令，不写完整剧本。
创建事件时以下字段都必须保留，结构示例仅供参考，禁止照抄示例内容（数组省略的同类项仍必须达到规定数量）：
{
  "event": {
    "title": "简短事件名",
    "category": "${intent.mainCategory ?? 'daily'}",
    "premise": "完整剧情大纲，概述开端、发展、转折、高潮与结局",
    "trigger": { "mode": "keywords", "condition": "用户明确进入本事件话题", "keywords": ["可匹配关键词"] },
    "steps": [
      ${stepExample}
    ]
  },
  "feedback": { "classification": "neutral", "confidence": 0.8, "reason": "简短理由" },
  "actions": [{ "characterId": "人物 id", "action": "具体行动", "evidence": ["人格证据"] }],
  "branches": [],
  "risks": [],
  "foreshadowing": [
    { "id": "clue-1", "status": "待使用", "connectedStepTitle": "行动导向的阶段小标题", "source": "当前资料中的来源", "surface": "符合当前题材的表面呈现", "plantStepId": "step-1", "revealStepId": "step-4", "recovery": "回收方式与影响", "conditionFactId": "fact-step-1", "maturity": 0, "threshold": 1 },
    { "id": "clue-2", "status": "未注入", "connectedStepTitle": "另一个真实阶段小标题", "source": "当前资料中的来源", "surface": "符合当前题材的表面呈现", "plantStepId": "step-2", "revealStepId": "step-5", "recovery": "回收方式与影响", "conditionFactId": "fact-step-2", "maturity": 0, "threshold": 1 }
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
  return `判断 user 对当前阶段的真实反馈，只能输出 decision 为 advance、revise、neutral 或 stop。只有当前阶段的 advancePoint 被 user 最新消息明确满足时，才允许 advance；必须同时返回 advanceSatisfied:true 和非空 evidence，引用或概括这条消息。无法确认时返回 advanceSatisfied:false 或 neutral。明确拒绝或强烈犹豫必须使用 revise，并结合人物侧写、用户意愿优先权重和不可改写的已发生事实重新规划后续阶段。
输出 { "decision": "neutral", "advanceSatisfied": false, "evidence": "", "reason": "简短依据" }。revise 时还必须提供完整的后续 steps 数组，不得改写已发生事实。`;
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
