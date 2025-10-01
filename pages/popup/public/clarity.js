(function (c, l, a, r, i, t, y) {
  c[a] =
    c[a] ||
    function () {
      (c[a].q = c[a].q || []).push(arguments);
    };
  t = l.createElement(r);
  t.async = 1;
  t.src = 'https://www.clarity.ms/tag/' + i;
  y = l.getElementsByTagName(r)[0];
  // y.parentNode.insertBefore(t, y);

  !(function (c, l, a, r, i, t, y) {
    a[c](
      'metadata',
      function () {
        a[c]('set', 'C_IS', '0');
      },
      !1,
      !0,
    );
    if (a[c].v || a[c].t) return a[c]('event', c, 'dup.' + i.projectId);
    (a[c].t = !0),
      ((t = l.createElement(r)).async = !0),
      (t.src = './clarity_0.88.js'),
      (y = l.getElementsByTagName(r)[0]).parentNode.insertBefore(t, y),
      a[c]('start', i),
      a[c].q.unshift(a[c].q.pop()),
      a[c]('set', 'C_IS', '0');
  })('clarity', document, window, 'script', {
    projectId: 'tibvbu4w6b',
    upload: 'https://z.clarity.ms/collect',
    expire: 365,
    cookies: ['_uetmsclkid', '_uetvid'],
    track: true,
    content: true,
    dob: 2100,
  });
})(window, document, 'clarity', 'script', 'tibvbu4w6b');
