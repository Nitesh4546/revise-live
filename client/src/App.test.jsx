import { describe, it, expect, beforeEach } from 'vitest';

const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};

const storage = (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function')
  ? window.localStorage
  : createStorageMock();

describe('Client sanity and storage checks', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('passes basic assertion', () => {
    expect(true).toBe(true);
  });

  it('stores per-PIN token keys (reviselive:player:{pin}) without collision', () => {
    const pin1 = '123456';
    const pin2 = '654321';
    const data1 = { playerId: 'p1', reconnectToken: 'tok-1', name: 'Alice', pin: pin1 };
    const data2 = { playerId: 'p2', reconnectToken: 'tok-2', name: 'Bob', pin: pin2 };

    storage.setItem(`reviselive:player:${pin1}`, JSON.stringify(data1));
    storage.setItem(`reviselive:player:${pin2}`, JSON.stringify(data2));

    expect(JSON.parse(storage.getItem(`reviselive:player:${pin1}`))).toEqual(data1);
    expect(JSON.parse(storage.getItem(`reviselive:player:${pin2}`))).toEqual(data2);

    storage.removeItem(`reviselive:player:${pin1}`);
    expect(storage.getItem(`reviselive:player:${pin1}`)).toBeNull();
    expect(JSON.parse(storage.getItem(`reviselive:player:${pin2}`))).toEqual(data2);
  });
});

