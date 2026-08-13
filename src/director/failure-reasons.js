function failureText(errorOrMessage) {
  return String(errorOrMessage?.message ?? errorOrMessage ?? '').trim();
}

export function classifyDirectorFailure(errorOrMessage) {
  const message = failureText(errorOrMessage);
  const name = String(errorOrMessage?.name ?? '');

  if (name === 'TimeoutError' || /timed?\s*out|请求超时/i.test(message)) return '模型请求超时';
  if (/empty content|empty response|returned?\s+nothing|空(?:内容|响应|回)/i.test(message)) return '模型返回空内容';
  if (name === 'DirectorTruncationError' || /finish_reason.{0,8}length|unexpected end of json|unterminated (?:string|object|array)|json.*(?:truncated|incomplete)/i.test(message)) return '模型输出被截断';
  if (/invalid director result|root must be an object|field is required|must be (?:an? )?(?:object|array)|category is unknown|classification is unknown/i.test(message)) return '模型返回的数据结构不符合要求';
  if (name === 'SyntaxError' || /json|expected property name|unexpected token/i.test(message)) return '模型返回格式错误';
  if (/failed to fetch|network|econn|enotfound|socket|http \d{3}|connection/i.test(message)) return '模型连接失败';
  return '事件生成时发生错误';
}

export function formatDirectorDiagnostic(errorOrMessage) {
  const reason = classifyDirectorFailure(errorOrMessage);
  const detail = failureText(errorOrMessage);
  return detail && detail !== reason ? `${reason}：${detail}` : reason;
}
