(function () {
  console.log('content script - 注入');

  window.setValue = (selector, value) => {
    const input = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!input) throw new Error('input元素不存在');
    // eslint-disable-next-line no-undef
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);
    // eslint-disable-next-line no-undef
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // eslint-disable-next-line no-undef
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // 改写 WebAuthn API
  Object.defineProperty(navigator, 'credentials', {
    value: {
      get: async () => {
        console.warn('WebAuthn 已被扩展禁用');
        throw new DOMException('WebAuthn disabled by extension', 'NotAllowedError');
      },
      create: async () => {
        console.warn('WebAuthn 注册已被扩展禁用');
        throw new DOMException('WebAuthn disabled by extension', 'NotAllowedError');
      },
    },
    configurable: false,
  });
})();
