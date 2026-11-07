// generator.js: dispatches each voice to the selected generator.
// The four modes are separate algorithms (melodic.js, rhythmic.js,
// hybrid.js, experimental.js); they share only the tonal frame.

GO.Generator = (function () {
  var MODES = ['melodic', 'rhythmic', 'hybrid', 'experimental'];
  function engine(type) {
    if (type === 'melodic') return GO.Melodic;
    if (type === 'rhythmic') return GO.Rhythmic;
    if (type === 'hybrid') return GO.Hybrid;
    if (type === 'experimental') return GO.Experimental;
    throw new Error('unknown generator ' + type);
  }
  // voices rendered later can read the ones rendered before them
  function order(type) { return type === 'hybrid' ? GO.Hybrid.ORDER : [0, 1, 2, 3]; }
  return {
    MODES: MODES,
    order: order,
    generate: function (type, rng, role, P, frame) { return engine(type).generate(rng, role, P, frame); },
    render: function (g, ctx, others) { return engine(g.type).render(g, ctx, others); },
    mutate: function (g, rng, P, frame) { return engine(g.type).mutate(g, rng, P, frame); }
  };
})();
