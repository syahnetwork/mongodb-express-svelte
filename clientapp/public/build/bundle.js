
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        if (value != null || input.value) {
            input.value = value;
        }
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined' ? window : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/components/navbar.svelte generated by Svelte v3.16.7 */

    const file = "src/components/navbar.svelte";

    function create_fragment(ctx) {
    	let nav;
    	let a;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a = element("a");
    			a.textContent = "Blog";
    			attr_dev(a, "class", "navbar-brand text-light");
    			attr_dev(a, "href", "#");
    			add_location(a, file, 9, 2, 101);
    			attr_dev(nav, "class", "navbar navbar-expand-lg navbar-light bg-dark");
    			add_location(nav, file, 8, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, a);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/components/PostForm.svelte generated by Svelte v3.16.7 */

    const { console: console_1 } = globals;
    const file$1 = "src/components/PostForm.svelte";

    // (107:10) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading ...";
    			add_location(p, file$1, 107, 12, 2828);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(107:10) {:else}",
    		ctx
    	});

    	return block;
    }

    // (62:10) {#if !loading}
    function create_if_block(ctx) {
    	let form;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let div2;
    	let label2;
    	let t7;
    	let input2;
    	let t8;
    	let div3;
    	let label3;
    	let t10;
    	let textarea;
    	let t11;
    	let button;
    	let t12_value = (/*editPost*/ ctx[0]._id ? "Update" : "Submit") + "";
    	let t12;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Title";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Category";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Author";
    			t7 = space();
    			input2 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Content";
    			t10 = space();
    			textarea = element("textarea");
    			t11 = space();
    			button = element("button");
    			t12 = text(t12_value);
    			attr_dev(label0, "for", "title");
    			add_location(label0, file$1, 64, 16, 1405);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "form-control");
    			attr_dev(input0, "id", "text");
    			attr_dev(input0, "placeholder", "Title");
    			add_location(input0, file$1, 65, 16, 1454);
    			attr_dev(div0, "class", "form-group");
    			add_location(div0, file$1, 63, 14, 1364);
    			attr_dev(label1, "for", "title");
    			add_location(label1, file$1, 74, 16, 1722);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "class", "form-control");
    			attr_dev(input1, "id", "text");
    			attr_dev(input1, "placeholder", "Category");
    			add_location(input1, file$1, 75, 16, 1774);
    			attr_dev(div1, "class", "form-group");
    			add_location(div1, file$1, 73, 14, 1681);
    			attr_dev(label2, "for", "title");
    			add_location(label2, file$1, 83, 16, 2047);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "form-control");
    			attr_dev(input2, "id", "text");
    			attr_dev(input2, "placeholder", "Author");
    			add_location(input2, file$1, 84, 16, 2097);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$1, 82, 14, 2006);
    			attr_dev(label3, "for", "content");
    			add_location(label3, file$1, 93, 16, 2367);
    			attr_dev(textarea, "class", "form-control");
    			attr_dev(textarea, "id", "content");
    			attr_dev(textarea, "rows", "3");
    			attr_dev(textarea, "placeholder", "Content");
    			add_location(textarea, file$1, 94, 16, 2420);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$1, 92, 14, 2326);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-primary");
    			add_location(button, file$1, 102, 14, 2654);
    			add_location(form, file$1, 62, 12, 1305);

    			dispose = [
    				listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    				listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    				listen_dev(input2, "input", /*input2_input_handler*/ ctx[9]),
    				listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[10]),
    				listen_dev(form, "submit", prevent_default(/*addNewPost*/ ctx[2]), false, true, false)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t1);
    			append_dev(div0, input0);
    			set_input_value(input0, /*editPost*/ ctx[0].title);
    			append_dev(form, t2);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t4);
    			append_dev(div1, input1);
    			set_input_value(input1, /*editPost*/ ctx[0].category);
    			append_dev(form, t5);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t7);
    			append_dev(div2, input2);
    			set_input_value(input2, /*editPost*/ ctx[0].author);
    			append_dev(form, t8);
    			append_dev(form, div3);
    			append_dev(div3, label3);
    			append_dev(div3, t10);
    			append_dev(div3, textarea);
    			set_input_value(textarea, /*editPost*/ ctx[0].content);
    			append_dev(form, t11);
    			append_dev(form, button);
    			append_dev(button, t12);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*editPost*/ 1 && input0.value !== /*editPost*/ ctx[0].title) {
    				set_input_value(input0, /*editPost*/ ctx[0].title);
    			}

    			if (dirty & /*editPost*/ 1 && input1.value !== /*editPost*/ ctx[0].category) {
    				set_input_value(input1, /*editPost*/ ctx[0].category);
    			}

    			if (dirty & /*editPost*/ 1 && input2.value !== /*editPost*/ ctx[0].author) {
    				set_input_value(input2, /*editPost*/ ctx[0].author);
    			}

    			if (dirty & /*editPost*/ 1) {
    				set_input_value(textarea, /*editPost*/ ctx[0].content);
    			}

    			if (dirty & /*editPost*/ 1 && t12_value !== (t12_value = (/*editPost*/ ctx[0]._id ? "Update" : "Submit") + "")) set_data_dev(t12, t12_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(62:10) {#if !loading}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let section;
    	let div3;
    	let div2;
    	let div1;
    	let div0;

    	function select_block_type(ctx, dirty) {
    		if (!/*loading*/ ctx[1]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			if_block.c();
    			attr_dev(div0, "class", "card p-3");
    			add_location(div0, file$1, 60, 8, 1245);
    			attr_dev(div1, "class", "col-md-5");
    			add_location(div1, file$1, 59, 6, 1214);
    			attr_dev(div2, "class", "row");
    			add_location(div2, file$1, 58, 4, 1190);
    			attr_dev(div3, "class", "container");
    			add_location(div3, file$1, 57, 2, 1162);
    			attr_dev(section, "class", "mt-4");
    			add_location(section, file$1, 56, 0, 1137);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			if_block.m(div0, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const baseUrl = "http://localhost:4000/blog";

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
    	let { editPost } = $$props;
    	let loading = false;

    	let data = {
    		title: "",
    		category: "",
    		author: "",
    		content: ""
    	};

    	let URL, method;

    	let addNewPost = async () => {
    		if (data.title.trim() === "" || data.category.trim() === "" || data.author.trim() === "" || data.content.trim() === "") {
    			return;
    		}

    		$$invalidate(1, loading = true);

    		if (editPost._id) {
    			URL = `${baseUrl}/${editPost._id}`;
    			method = "PUT";
    			console.log("pre", editPost);
    		} else {
    			URL = `${baseUrl}`;
    			method = "POST";
    			console.log("not", editPost);
    		}

    		const res = await fetch(URL, {
    			method,
    			headers: { "Content-Type": "application/json" },
    			body: JSON.stringify(data)
    		});

    		const post = res.json();
    		dispatch("postCreated", post);

    		data = {
    			title: "",
    			category: "",
    			author: "",
    			content: ""
    		};

    		$$invalidate(1, loading = false);
    	};

    	const writable_props = ["editPost"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<PostForm> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		editPost.title = this.value;
    		$$invalidate(0, editPost);
    	}

    	function input1_input_handler() {
    		editPost.category = this.value;
    		$$invalidate(0, editPost);
    	}

    	function input2_input_handler() {
    		editPost.author = this.value;
    		$$invalidate(0, editPost);
    	}

    	function textarea_input_handler() {
    		editPost.content = this.value;
    		$$invalidate(0, editPost);
    	}

    	$$self.$set = $$props => {
    		if ("editPost" in $$props) $$invalidate(0, editPost = $$props.editPost);
    	};

    	$$self.$capture_state = () => {
    		return {
    			editPost,
    			loading,
    			data,
    			URL,
    			method,
    			addNewPost
    		};
    	};

    	$$self.$inject_state = $$props => {
    		if ("editPost" in $$props) $$invalidate(0, editPost = $$props.editPost);
    		if ("loading" in $$props) $$invalidate(1, loading = $$props.loading);
    		if ("data" in $$props) data = $$props.data;
    		if ("URL" in $$props) URL = $$props.URL;
    		if ("method" in $$props) method = $$props.method;
    		if ("addNewPost" in $$props) $$invalidate(2, addNewPost = $$props.addNewPost);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*editPost*/ 1) {
    			 data = editPost;
    		}
    	};

    	return [
    		editPost,
    		loading,
    		addNewPost,
    		data,
    		URL,
    		method,
    		dispatch,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		textarea_input_handler
    	];
    }

    class PostForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment$1, safe_not_equal, { editPost: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PostForm",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*editPost*/ ctx[0] === undefined && !("editPost" in props)) {
    			console_1.warn("<PostForm> was created without expected prop 'editPost'");
    		}
    	}

    	get editPost() {
    		throw new Error("<PostForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set editPost(value) {
    		throw new Error("<PostForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Home.svelte generated by Svelte v3.16.7 */
    const file$2 = "src/components/Home.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (55:6) {:else}
    function create_else_block$1(ctx) {
    	let each_1_anchor;
    	let each_value = /*posts*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*deletePost, posts, editPostDetails*/ 25) {
    				each_value = /*posts*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(55:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (53:6) {#if posts.length === 0}
    function create_if_block$1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Loading";
    			add_location(p, file$2, 53, 8, 1218);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(53:6) {#if posts.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (56:8) {#each posts as post}
    function create_each_block(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let t0_value = /*post*/ ctx[5].category + "";
    	let t0;
    	let t1;
    	let div1;
    	let h5;
    	let t2_value = /*post*/ ctx[5].title + "";
    	let t2;
    	let t3;
    	let p;
    	let t4_value = /*post*/ ctx[5].content + "";
    	let t4;
    	let t5;
    	let button0;
    	let t7;
    	let button1;
    	let t9;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			h5 = element("h5");
    			t2 = text(t2_value);
    			t3 = space();
    			p = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t7 = space();
    			button1 = element("button");
    			button1.textContent = "Delete";
    			t9 = space();
    			attr_dev(div0, "class", "card-header");
    			add_location(div0, file$2, 58, 14, 1360);
    			attr_dev(h5, "class", "card-title");
    			add_location(h5, file$2, 60, 16, 1461);
    			attr_dev(p, "class", "card-text");
    			add_location(p, file$2, 61, 16, 1518);
    			attr_dev(button0, "class", "btn btn-info");
    			add_location(button0, file$2, 62, 16, 1574);
    			attr_dev(button1, "class", "btn btn-danger");
    			add_location(button1, file$2, 65, 16, 1702);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$2, 59, 14, 1421);
    			attr_dev(div2, "class", "card");
    			add_location(div2, file$2, 57, 12, 1327);
    			attr_dev(div3, "class", "col-md-4 mb-3");
    			add_location(div3, file$2, 56, 10, 1287);

    			dispose = [
    				listen_dev(
    					button0,
    					"click",
    					function () {
    						if (is_function(/*editPostDetails*/ ctx[4](/*post*/ ctx[5]))) /*editPostDetails*/ ctx[4](/*post*/ ctx[5]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				),
    				listen_dev(
    					button1,
    					"click",
    					function () {
    						if (is_function(/*deletePost*/ ctx[3](/*post*/ ctx[5]._id))) /*deletePost*/ ctx[3](/*post*/ ctx[5]._id).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				)
    			];
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, h5);
    			append_dev(h5, t2);
    			append_dev(div1, t3);
    			append_dev(div1, p);
    			append_dev(p, t4);
    			append_dev(div1, t5);
    			append_dev(div1, button0);
    			append_dev(div1, t7);
    			append_dev(div1, button1);
    			append_dev(div3, t9);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*posts*/ 1 && t0_value !== (t0_value = /*post*/ ctx[5].category + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*posts*/ 1 && t2_value !== (t2_value = /*post*/ ctx[5].title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*posts*/ 1 && t4_value !== (t4_value = /*post*/ ctx[5].content + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(56:8) {#each posts as post}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let t;
    	let section;
    	let div1;
    	let div0;
    	let current;

    	const postform = new PostForm({
    			props: { editPost: /*editPost*/ ctx[1] },
    			$$inline: true
    		});

    	postform.$on("postCreated", /*addpost*/ ctx[2]);

    	function select_block_type(ctx, dirty) {
    		if (/*posts*/ ctx[0].length === 0) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			create_component(postform.$$.fragment);
    			t = space();
    			section = element("section");
    			div1 = element("div");
    			div0 = element("div");
    			if_block.c();
    			attr_dev(div0, "class", "row");
    			add_location(div0, file$2, 51, 4, 1161);
    			attr_dev(div1, "class", "container");
    			add_location(div1, file$2, 50, 2, 1133);
    			attr_dev(section, "class", "mt-5");
    			add_location(section, file$2, 49, 0, 1108);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(postform, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, div1);
    			append_dev(div1, div0);
    			if_block.m(div0, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const postform_changes = {};
    			if (dirty & /*editPost*/ 2) postform_changes.editPost = /*editPost*/ ctx[1];
    			postform.$set(postform_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(postform.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(postform.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(postform, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(section);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const baseUrl$1 = "http://localhost:4000/blog";

    function instance$1($$self, $$props, $$invalidate) {
    	let posts = [];

    	let editPost = {
    		title: "",
    		category: "",
    		author: "",
    		content: "",
    		_id: null
    	};

    	onMount(async () => {
    		let res = await fetch(baseUrl$1);
    		$$invalidate(0, posts = await res.json());
    		console.log(posts);
    	});

    	let addpost = ({ detail: post }) => {
    		if (posts.find(p => p._id === post._id)) {
    			const index = posts.findIndex(p => p._id === post._id);
    			let postUpdated = posts;
    			console.log(postUpdated);
    			postUpdated.splice(index, 1, post);
    			$$invalidate(0, posts = postUpdated);
    		} else {
    			$$invalidate(0, posts = [post, ...posts]);
    		}
    	};

    	let deletePost = async id => {
    		if (confirm("Are You Sure?")) {
    			let res = await fetch(`${baseUrl$1}/${id}`, { method: "DELETE" });
    			$$invalidate(0, posts = posts.filter(p => p._id !== id));
    		} else {
    			alert("Your Post is safe!!");
    		}
    	};

    	let editPostDetails = async post => {
    		$$invalidate(1, editPost = post);
    	};

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("posts" in $$props) $$invalidate(0, posts = $$props.posts);
    		if ("editPost" in $$props) $$invalidate(1, editPost = $$props.editPost);
    		if ("addpost" in $$props) $$invalidate(2, addpost = $$props.addpost);
    		if ("deletePost" in $$props) $$invalidate(3, deletePost = $$props.deletePost);
    		if ("editPostDetails" in $$props) $$invalidate(4, editPostDetails = $$props.editPostDetails);
    	};

    	return [posts, editPost, addpost, deletePost, editPostDetails];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.16.7 */

    function create_fragment$3(ctx) {
    	let t;
    	let current;
    	const navbar = new Navbar({ $$inline: true });
    	const home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t = space();
    			create_component(home.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, null, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
