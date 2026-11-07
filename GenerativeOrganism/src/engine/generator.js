// generator.js: dispatches each voice to the selected generator.
// Stage B adds HYBRID and EXPERIMENTAL here as separate algorithms.

GO.Generator = (function () {
  var MODES = ['melodic', 'rhythmic'];
  function engine(type) {
    if (type === 'melodic') return GO.Melodic;
    if (type === 'rhythmic') return GO.Rhythmic;
    throw new Error('unknown generator ' + type);
  }
  return {
    MODES: MODES,
    generate: function (type, rng, role, P, n) { return engine(type).generate(rng, role, P, n); },
    render: function (g, ctx, src) { return engine(g.type).render(g, ctx, src); },
    mutate: function (g, rng, P, n) { return engine(g.type).mutate(g, rng, P, n); }
  };
})();
