window.QMRecords = (() => {
  function canPlot(d) {
    return Number.isFinite(d.storageTimeS) && d.storageTimeS > 0 &&
      Number.isFinite(d.efficiencyPct) && d.efficiencyPct > 0;
  }

  function protocolGroup(d) {
    if (["AFC", "spin-wave AFC", "ZEFOZ spin-wave AFC", "AFC / feed-forward", "AFC / Stark control", "on-demand AFC", "SMAFC"].includes(d.protocol)) return "AFC";
    if (d.protocol === "NLPE / spin-wave") return "NLPE";
    return d.protocol || "other";
  }

  function implementationGroup(d) {
    return ["integrated chip", "integrated membrane", "integrated waveguide", "nanophotonic resonator", "nanophotonic waveguide"].includes(d.architecture) ? "chip" : "bulk";
  }

  function cavityGroup(d) {
    const value = String(d.cavity || "").toLowerCase();
    if (value === "no cavity") return "no cavity";
    if (value.includes("fiber microcavity")) return "fiber microcavity";
    if (value.includes("impedance-matched")) return "bulk cavity";
    if (value.includes("multi-pass")) return "multi-pass";
    if (value.includes("nanobeam") || value.includes("nanocavity")) return "nanobeam cavity";
    if (value.includes("on-chip")) return "on-chip resonator";
    if (value.includes("waveguide cavity")) return "waveguide cavity";
    return d.cavity || "other";
  }

  function normalize(value) {
    return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}+]+/gu, " ").trim();
  }

  function indexText(fields) {
    const text = normalize(fields.join(" "));
    return { phrase: ` ${text} `, compact: text.replaceAll(" ", "") };
  }

  function containsTerm(text, term) {
    return text.phrase.includes(` ${term} `) || (term.length >= 4 && text.compact.includes(term));
  }

  function individualNames(fullNames) {
    return String(fullNames || "").split(",").flatMap((name) => {
      const parts = normalize(name).split(" ");
      if (parts.length < 2) return [normalize(name)];
      const surname = parts.pop();
      const initials = parts.map((part) => part[0]);
      return [normalize(name), `${initials.join(" ")} ${surname}`, `${initials[0]} ${surname}`];
    }).map((name) => ` ${name} `);
  }

  function indexRecord(d, authors) {
    const material = normalize([d.host, d.title, d.note].join(" "));
    const element = String(d.ion || "").replace(/\d+[+-]?$/, "");
    const general = [d.title, d.venue, d.ion, element, d.isotope, d.host, d.protocol, protocolGroup(d),
      d.architecture, implementationGroup(d), d.cavity, cavityGroup(d), d.inputState, d.note];
    if (material.includes("y2sio5")) general.push("YSO yttrium orthosilicate");
    if (material.includes("linbo3") || material.includes("lithium niobate")) general.push("LN LiNbO3 lithium niobate");
    return {
      general: indexText(general),
      authors: indexText([d.authors, d.authorsFull, d.searchTerms, authors.authorsFull, authors.searchTerms]),
      names: individualNames(authors.authorsFull || d.authorsFull)
    };
  }

  function compile(query) {
    const dois = [];
    const words = query.replace(/(?:\bdoi:\s*)?(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)/gi, (_, doi) => {
      dois.push(doi.toLowerCase().replace(/[.,;]+$/, ""));
      return " ";
    });
    const terms = normalize(words).split(" ").filter(Boolean);
    return (d, entry) => {
      if (!dois.every((doi) => doi === d.doi?.toLowerCase())) return false;
      if (!terms.length) return dois.length > 0;
      const name = [];
      for (const term of terms) {
        if (/^(19|20)\d{2}$/.test(term)) {
          if (String(d.year) !== term) return false;
        } else if (!containsTerm(entry.general, term)) {
          name.push(term);
        }
      }
      if (!name.length) return true;
      if (name.length === 1) return containsTerm(entry.authors, name[0]);
      // Match initials within one author; the free-text aliases have no name delimiters.
      const phrases = [` ${name.join(" ")} `];
      if (name.length === 2) phrases.push(` ${name[1]} ${name[0]} `);
      if (name.some((term) => term.length === 1)) {
        return entry.names.some((author) => phrases.some((phrase) => author.includes(phrase)));
      }
      return phrases.some((phrase) => entry.authors.phrase.includes(phrase));
    };
  }

  function createSearch(records, authorIndex) {
    const index = new Map(records.map((d) => [d.id, indexRecord(d, authorIndex[d.id] || {})]));
    let lastQuery;
    let match;
    return (d, query) => {
      query = (query || "").trim();
      if (!query) return true;
      if (index.has(query)) return d.id === query;
      if (lastQuery !== query) {
        match = compile(query);
        lastQuery = query;
      }
      return match(d, index.get(d.id));
    };
  }

  return { createSearch, canPlot, protocolGroup, implementationGroup, cavityGroup };
})();
