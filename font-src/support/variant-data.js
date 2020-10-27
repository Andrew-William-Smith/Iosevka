"use strict";

exports.apply = applyVariantData;
function applyVariantData(data, para, argv) {
	const parsed = parseVariantsData(data);
	let tagSet = new Set();
	for (const prime of parsed.primes.values()) {
		if (!prime.tag) continue;
		if (!tagSet.has(prime.tag)) tagSet.add(prime.tag);
		else throw new Error(`CV tag conflict: ${prime.tag}`);
	}

	const variantSelector = {};
	parsed.defaultComposite.resolve(para, parsed.selectorTree, parsed.composites, variantSelector);
	if (argv.serif === "slab") {
		const slabComp = parsed.composites.get("slab");
		slabComp.resolve(para, parsed.selectorTree, parsed.composites, variantSelector);
	}
	if (argv.variants) {
		const userComposite = new Composite("{user}", argv.variants);
		userComposite.resolve(para, parsed.selectorTree, parsed.composites, variantSelector);
	}

	para.variants = {
		selectorTree: parsed.selectorTree,
		primes: parsed.primes,
		composites: parsed.composites
	};
	para.variantSelector = variantSelector;
}

exports.parse = parseVariantsData;
function parseVariantsData(data) {
	const primes = new Map();
	const selectorTree = new SelectorTree();
	for (const k in data.prime) {
		const p = new Prime(k, data.prime[k]);
		p.register(selectorTree);
		primes.set(k, p);
	}

	const defaultComposite = new Composite("{default}", data.default);
	const composites = new Map();
	for (const k in data.composite) {
		const comp = new Composite(k, data.composite[k]);
		composites.set(k, comp);
	}

	return { selectorTree: selectorTree, primes, composites, defaultComposite };
}

class SelectorTree {
	constructor() {
		this.m_mapping = new Map();
	}
	get(kPrime, kVariant) {
		if (!this.m_mapping.has(kPrime)) return undefined;
		return this.m_mapping.get(kPrime).get(kVariant);
	}
	set(kPrime, kVariant, prime, variant) {
		if (!this.m_mapping.has(kPrime)) this.m_mapping.set(kPrime, new Map());
		this.m_mapping.get(kPrime).set(kVariant, [prime, variant]);
	}
	*[Symbol.iterator]() {
		for (const m of this.m_mapping.values()) yield* m.values();
	}
}

class Composite {
	constructor(key, cfg) {
		this.key = key;
		this.tag = cfg.tag;
		this.description = cfg.description;
		this.inherits = cfg.inherits;
		this.design = cfg.design;
		this.upright = cfg.upright;
		this.italic = cfg.italic;
	}
	decompose(para, selTree) {
		const ans = [];
		const cfg = Object.assign({}, this.design, para.isItalic ? this.italic : this.upright);
		for (const [k, v] of Object.entries(cfg)) {
			const pv = selTree.get(k, v);
			if (!pv) throw new Error(`Composite ${this.key} cannot be resolved: ${[k, v]}.`);
			ans.push(pv);
		}
		return ans;
	}
	resolve(para, selTree, catalog, vs) {
		if (this.inherits) {
			if (!catalog.has(this.inherits)) {
				throw new Error(`Cannot find composite variant: ${this.inherits}`);
			}
			catalog.get(this.inherits).resolve(para, selTree, catalog, vs);
		}
		for (const [prime, variant] of this.decompose(para, selTree)) {
			variant.resolve(para, vs);
		}
	}
}

class Prime {
	constructor(key, cfg) {
		this.key = key;
		this.sampler = cfg.sampler;
		this.tag = cfg.tag;
		if (!cfg.variants) throw new Error(`Missing variants in ${key}`);
		this.variants = new Map();
		for (const varKey in cfg.variants) {
			const variant = cfg.variants[varKey];
			this.variants.set(varKey, new PrimeVariant(varKey, cfg.tag, variant));
		}
	}
	register(tree) {
		for (const [k, v] of this.variants) tree.set(this.key, k, this, v);
		if (this.tag) {
			for (const v of this.variants.values()) if (v.rank) tree.set(this.tag, v.rank, this, v);
		}
	}
}

class PrimeVariant {
	constructor(key, tag, cfg) {
		this.key = key;
		this.tag = tag;
		this.description = cfg.description;
		this.rank = cfg.rank;
		this.selector = cfg.selector;
		this.selectorUpright = cfg.selectorUpright;
		this.selectorItalic = cfg.selectorItalic;
	}
	resolveFor(para, gn) {
		let vs = {};
		this.resolve(para, vs);
		return vs[gn];
	}
	resolve(para, vs) {
		Object.assign(vs, this.selector);
		if (para.isItalic) {
			Object.assign(vs, this.selectorItalic);
		} else {
			Object.assign(vs, this.selectorUpright);
		}
	}
}
