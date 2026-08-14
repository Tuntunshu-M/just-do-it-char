import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPreferencesView } from '../../src/ui/views/preferences.js';

function documentFixture() {
  const doc = {
    createElement(tagName) {
      const items = [];
      const children = new Proxy({}, {
        get(_target, key) {
          if (key === 'length') return items.length;
          if (key === Symbol.iterator) return items[Symbol.iterator].bind(items);
          if (/^\d+$/.test(String(key))) return items[Number(key)];
          return undefined;
        },
      });
      return {
        ownerDocument: doc,
        tagName,
        children,
        attributes: {},
        textContent: '',
        className: '',
        append(...nodes) { items.push(...nodes); },
        setAttribute(key, value) { this.attributes[key] = String(value); },
      };
    },
  };
  return doc;
}

function flatten(node) {
  return [node, ...Array.from(node.children ?? []).flatMap(flatten)];
}

test('preferences render with browser-like HTMLCollection and only idle controls are disabled', () => {
  const doc = documentFixture();
  const body = doc.createElement('section');
  const permissions = {
    death: 'ask', permanentDisability: 'ask', pregnancy: 'ask', childbirth: 'ask',
    seriousIllness: 'ask', longDisappearance: 'ask', permanentBreakup: 'ask', majorPropertyChange: 'ask',
  };
  const settings = {
    categories: {
      daily: { enabled: true, weight: 50 }, crisis: { enabled: true, weight: 30 }, erotic: { enabled: false, weight: 20 },
    },
    genre: { mode: 'auto', custom: '' },
    trigger: { mode: 'hybrid', fixedTurns: 4, idleEnabled: false, idleMinutes: 30, allowedWindows: [['09:00', '23:00']] },
    defaults: { consequencePermissions: permissions },
  };
  const state = {
    preference: { userAgency: 50, consequencePermissions: { ...permissions } },
    sceneSafety: { safewords: [], hardLimits: [], cncEnabled: false },
  };

  assert.doesNotThrow(() => renderPreferencesView({
    body, settings, state, services: {}, saveSettings() {}, saveState() {}, rerender() {},
  }));

  const nodes = flatten(body);
  const labels = nodes.filter((node) => node.tagName === 'label');
  const idleLabel = labels.find((node) => node.children?.[0]?.textContent.includes('还没做'));
  assert.ok(idleLabel, 'idle trigger label should show the unfinished marker');
  const disabled = nodes.filter((node) => ['input', 'select', 'textarea'].includes(node.tagName) && node.disabled);
  assert.equal(disabled.length, 3);
  assert.equal(nodes.find((node) => node.tagName === 'input' && node.attributes.type === 'range')?.disabled, undefined);
});
