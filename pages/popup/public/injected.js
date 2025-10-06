(function () {
  console.log('content script - 注入');
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
