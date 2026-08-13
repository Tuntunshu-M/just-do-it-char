import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDirectorFailure, formatDirectorDiagnostic } from '../../src/director/failure-reasons.js';

test('director failures are classified into concise Chinese reasons', () => {
  assert.equal(classifyDirectorFailure('Director API returned empty content'), '模型返回空内容');
  assert.equal(classifyDirectorFailure('Unexpected end of JSON input'), '模型输出被截断');
  assert.equal(classifyDirectorFailure('Unterminated string in JSON'), '模型输出被截断');
  assert.equal(classifyDirectorFailure('SyntaxError: Expected property name in JSON'), '模型返回格式错误');
  assert.equal(classifyDirectorFailure('Invalid director result: event must be an object or null'), '模型返回的数据结构不符合要求');
  assert.equal(classifyDirectorFailure(Object.assign(new Error('aborted'), { name: 'TimeoutError' })), '模型请求超时');
  assert.equal(classifyDirectorFailure('TypeError: Failed to fetch'), '模型连接失败');
  assert.equal(classifyDirectorFailure('something unknown'), '事件生成时发生错误');
});

test('diagnostic failure text keeps concise and technical information', () => {
  assert.equal(
    formatDirectorDiagnostic('Invalid director result: event must be an object or null'),
    '模型返回的数据结构不符合要求：Invalid director result: event must be an object or null',
  );
  assert.equal(formatDirectorDiagnostic('Director API returned empty content'), '模型返回空内容：Director API returned empty content');
});
