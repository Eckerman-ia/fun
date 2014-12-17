// Copyright by Karol Guciek (http://guciek.github.io)
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, version 2 or 3.

function jijitai(env) {
    "use strict";

    var matrix = (function () {
        function wrapper(h, w, v) {
            return {
                cell: function (y, x) {
                    return v[y * w + x];
                },
                set_cell: function (y, x, val) {
                    val = Number(val);
                    if (isNaN(val)) {
                        throw "Setting matrix cell to NaN!";
                    }
                    var i, v2 = [];
                    for (i = 0; i < h * w; i += 1) {
                        v2[i] = v[i];
                    }
                    v2[y * w + x] = val;
                    return wrapper(h, w, v2);
                },
                add: function (m2) {
                    if ((w !== m2.width()) || (h !== m2.height())) {
                        throw "Invalid matrix addition!";
                    }
                    var y, x, v2 = [];
                    for (y = 0; y < h; y += 1) {
                        for (x = 0; x < w; x += 1) {
                            v2.push(v[y * w + x] + m2.cell(y, x));
                        }
                    }
                    return wrapper(h, w, v2);
                },
                sub: function (m2) {
                    if ((w !== m2.width()) || (h !== m2.height())) {
                        throw "Invalid matrix subtraction!";
                    }
                    var y, x, v2 = [];
                    for (y = 0; y < h; y += 1) {
                        for (x = 0; x < w; x += 1) {
                            v2.push(v[y * w + x] - m2.cell(y, x));
                        }
                    }
                    return wrapper(h, w, v2);
                },
                mult: function (m2) {
                    var s, y, x, i, v2 = [];
                    if (typeof m2 === "object") {
                        if (w !== m2.height()) {
                            throw "Invalid matrix multiplication!";
                        }
                        for (y = 0; y < h; y += 1) {
                            for (x = 0; x < m2.width(); x += 1) {
                                s = 0;
                                for (i = 0; i < w; i += 1) {
                                    s += v[y * w + i] * m2.cell(i, x);
                                }
                                v2.push(s);
                            }
                        }
                        return wrapper(h, m2.width(), v2);
                    }
                    m2 = Number(m2);
                    if (isNaN(m2)) {
                        throw "Invalid multiplication by NaN!";
                    }
                    for (y = 0; y < h; y += 1) {
                        for (x = 0; x < w; x += 1) {
                            v2.push(v[y * w + x] * m2);
                        }
                    }
                    return wrapper(h, w, v2);
                },
                width: function () {
                    return w;
                },
                height: function () {
                    return h;
                }
            };
        }
        function zeros(h, w) {
            var i, v = [];
            for (i = 0; i < h * w; i += 1) {
                v.push(0);
            }
            return wrapper(h, w, v);
        }
        function identity(s) {
            var y, x, v = [];
            for (y = 0; y < s; y += 1) {
                for (x = 0; x < s; x += 1) {
                    v.push((y === x) ? 1 : 0);
                }
            }
            return wrapper(s, s, v);
        }
        function vector(arr) {
            var y, a, v = [];
            for (y = 0; y < arr.length; y += 1) {
                a = Number(arr[y]);
                if (isNaN(a)) {
                    throw "Initializing a vector with NaN!";
                }
                v.push(a);
            }
            return wrapper(arr.length, 1, v);
        }
        return {
            zeros: zeros,
            identity: identity,
            vector: vector
        };
    }());

    function dist(p1, p2) {
        if ((p1.width() !== 1) || (p2.width() !== 1) ||
                (p1.height() !== p2.height())) {
            throw "Invalid vectors for computing distance!";
        }
        var v, s = 0, i;
        for (i = 0; i < p1.height(); i += 1) {
            v = p1.cell(i, 0) - p2.cell(i, 0);
            s += v * v;
        }
        return Math.sqrt(s);
    }

    function webgl(canvas) {
        var gl,
            cur_program,
            canvas_w = 0,
            canvas_h = 0;

        try {
            gl = canvas.getContext("webgl");
            if (!gl) { throw "x"; }
        } catch (err) {
            throw "Your web browser does not support WebGL!";
        }

        function update_viewport() {
            if ((canvas.width !== canvas_w) || (canvas.height !== canvas_h)) {
                canvas_w = canvas.width;
                canvas_h = canvas.height;
                gl.viewport(0, 0, canvas_w, canvas_h);
            }
        }

        env.runOnCanvasResize(update_viewport);
        update_viewport();

        function new_program(vs, fs) {
            var prog = gl.createProgram(),
                attributes = {},
                uniforms = {},
                attr_length = 0;
            function addshader(type, source) {
                var s = gl.createShader(type);
                gl.shaderSource(s, source);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    throw "Could not compile shader: " +
                            gl.getShaderInfoLog(s);
                }
                gl.attachShader(prog, s);
            }
            function attribute_init_vec(n, vsize) {
                var attr = gl.getAttribLocation(prog, n);
                if (attr < 0) {
                    throw "Could not load attribute location!";
                }
                gl.enableVertexAttribArray(attr);
                return {
                    set_buffer: function (bufob) {
                        bufob.webgl_bind();
                        gl.vertexAttribPointer(attr, vsize, gl.FLOAT,
                                false, 0, 0);
                        attr_length = Math.floor(bufob.length() / vsize);
                    }
                };
            }
            function uniform_init_float(n) {
                var attr = gl.getUniformLocation(prog, n);
                if (attr < 0) {
                    throw "Could not load uniform variable location!";
                }
                return {
                    set_value : function (val) {
                        gl.uniform1f(attr, val);
                    }
                };
            }
            function uniform_init_vec3(n) {
                var attr = gl.getUniformLocation(prog, n);
                if (attr < 0) {
                    throw "Could not load uniform variable location!";
                }
                return {
                    set_matrix : function (m) {
                        if ((m.width() !== 1) || (m.height() !== 3)) {
                            throw "Invalid matrix size!";
                        }
                        gl.uniform3f(attr,
                                m.cell(0, 0), m.cell(1, 0), m.cell(2, 0));
                    }
                };
            }
            function uniform_init_mat(n) {
                var attr = gl.getUniformLocation(prog, n);
                if (attr < 0) {
                    throw "Could not load uniform variable location!";
                }
                return {
                    set_matrix : function (m) {
                        var x, y, values = [];
                        for (x = 0; x < m.width(); x += 1) {
                            for (y = 0; y < m.height(); y += 1) {
                                values.push(m.cell(y, x));
                            }
                        }
                        values = new Float32Array(values);
                        if ((m.width() === 3) && (m.height() === 3)) {
                            gl.uniformMatrix3fv(attr, gl.FALSE, values);
                        } else {
                            throw "Invalid matrix size!";
                        }
                    }
                };
            }
            function activate() {
                if (cur_program !== prog) {
                    cur_program = prog;
                    gl.useProgram(prog);
                }
            }
            addshader(gl.VERTEX_SHADER, vs);
            addshader(gl.FRAGMENT_SHADER, fs);
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                throw "Could not link the shader program!";
            }
            return {
                draw_triangles : function (begin, end) {
                    if (attr_length < 1) {
                        throw "Buffer length unknown!";
                    }
                    activate();
                    var start = begin || 0;
                    gl.drawArrays(gl.TRIANGLES, start,
                            end || attr_length - start);
                },
                attribute_vec2: function (n) {
                    if (attributes[n]) {
                        return attributes[n];
                    }
                    activate();
                    attributes[n] = attribute_init_vec(n, 2);
                    return attributes[n];
                },
                attribute_vec3: function (n) {
                    if (attributes[n]) {
                        return attributes[n];
                    }
                    activate();
                    attributes[n] = attribute_init_vec(n, 3);
                    return attributes[n];
                },
                uniform_float: function (n) {
                    if (uniforms[n]) {
                        return uniforms[n];
                    }
                    activate();
                    uniforms[n] = uniform_init_float(n);
                    return uniforms[n];
                },
                uniform_vec3: function (n) {
                    if (uniforms[n]) {
                        return uniforms[n];
                    }
                    activate();
                    uniforms[n] = uniform_init_vec3(n);
                    return uniforms[n];
                },
                uniform_mat3: function (n) {
                    if (uniforms[n]) {
                        return uniforms[n];
                    }
                    activate();
                    uniforms[n] = uniform_init_mat(n);
                    return uniforms[n];
                }
            };
        }

        function new_buffer_float32(arr) {
            arr = new Float32Array(arr);
            if (arr.length < 1) { throw "Invalid buffer data!"; }
            var ret, buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
            ret = {
                length: function () {
                    return arr.length;
                },
                webgl_bind: function () {
                    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                    return ret;
                }
            };
            return ret;
        }

        function new_texture() {
            var ret, t = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, t);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            ret = {
                set_image: function (i) {
                    gl.bindTexture(gl.TEXTURE_2D, t);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB,
                            gl.UNSIGNED_BYTE, i);
                    return ret;
                },
                webgl_bind: function () {
                    gl.bindTexture(gl.TEXTURE_2D, t);
                    return ret;
                }
            };
            return ret;
        }

        return {
            new_program: new_program,
            new_buffer_float32: new_buffer_float32,
            new_texture: new_texture,
            clear : function (r, g, b) {
                gl.clearColor(r || 0, g || 0, b || 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
        };
    }

    function icosahedron() {
        var s = 0.52573111211,
            t = 0.85065080835,
            v = [
                matrix.vector([-s, t, 0]),
                matrix.vector([s, t, 0]),
                matrix.vector([-s, -t, 0]),
                matrix.vector([s, -t, 0]),
                matrix.vector([0, -s, t]),
                matrix.vector([0, s, t]),
                matrix.vector([0, -s, -t]),
                matrix.vector([0, s, -t]),
                matrix.vector([t, 0, -s]),
                matrix.vector([t, 0, s]),
                matrix.vector([-t, 0, -s]),
                matrix.vector([-t, 0, s])
            ];
        return [
            v[0], v[11], v[5],
            v[0], v[5], v[1],
            v[0], v[1], v[7],
            v[0], v[7], v[10],
            v[0], v[10], v[11],
            v[1], v[5], v[9],
            v[5], v[11], v[4],
            v[11], v[10], v[2],
            v[10], v[7], v[6],
            v[7], v[1], v[8],
            v[3], v[9], v[4],
            v[3], v[4], v[2],
            v[3], v[2], v[6],
            v[3], v[6], v[8],
            v[3], v[8], v[9],
            v[4], v[9], v[5],
            v[2], v[4], v[11],
            v[6], v[2], v[10],
            v[8], v[6], v[7],
            v[9], v[8], v[1]
        ];
    }

    function render_ray(formula, cx, cy, cz, sx, sy, sz, step, max, oncollision) {
        var i = 0.7, x, y, z, d, prev_d;
        while (i < max) {
            prev_d = d;
            x = cx + i * sx;
            y = cy + i * sy;
            z = cz + i * sz;
            d = x * x + y * y + z * z;
            if ((d > 1) && prev_d && (d > prev_d)) {
                return false;
            }
            if ((d <= 1) && formula(x, y, z)) {
                if (i <= 1) {
                    oncollision();
                }
                if (i === 0.7) {
                    return true;
                }
                x -= cx;
                y -= cy;
                z -= cz;
                d = -Math.log(Math.sqrt(x * x + y * y + z * z)) * 3;
                return [0.5 + Math.sin(d) * 0.5, 0.5 + Math.cos(d) * 0.5, 1];
            }
            i *= (1 + step);
        }
        return false;
    }

    function triangle_renderer() {
        var w = webgl(env.canvas()),
            prog = w.new_program(
                "precision mediump float;" +
                    "uniform float ratio;" +
                    "attribute vec3 xyz;" +
                    "attribute vec2 uv;" +
                    "uniform vec3 pos;" +
                    "uniform mat3 rot;" +
                    "varying vec2 v_st;" +
                    "void main() {" +
                    "    v_st = uv;" +
                    "    vec3 p = rot * (xyz + pos);" +
                    "    gl_Position = vec4(p.x * ratio, p.y, p.z, p.z);" +
                    "}",
                "precision mediump float;" +
                    "varying vec2 v_st;" +
                    "uniform sampler2D sampl;" +
                    "void main() {" +
                    "    vec4 c = texture2D(sampl, vec2(v_st.s, v_st.t));" +
                    "    if (c.xyz == vec3(0.0)) discard;" +
                    "    gl_FragColor = c;" +
                    "}"
            ),
            mesh = icosahedron(),
            last_ratio = 1;

        function update_ratio() {
            last_ratio = env.canvas().height / env.canvas().width;
            prog.uniform_float("ratio").set_value(last_ratio);
        }
        update_ratio();
        env.runOnCanvasResize(update_ratio);

        prog.attribute_vec3("xyz").set_buffer((function () {
            var i, a = [];
            for (i = 0; i < mesh.length; i += 1) {
                a.push(mesh[i].cell(0, 0));
                a.push(mesh[i].cell(1, 0));
                a.push(mesh[i].cell(2, 0));
            }
            return w.new_buffer_float32(a);
        }()));

        prog.attribute_vec2("uv").set_buffer((function () {
            var i, a = [];
            for (i = 0; i < mesh.length; i += 3) {
                a.push(0.5);
                a.push(0);
                a.push(0);
                a.push(1);
                a.push(1);
                a.push(1);
            }
            return w.new_buffer_float32(a);
        }()));

        function interpolate(p1, p2, part) {
            return p1.mult(1 - part).add(p2.mult(part));
        }

        function point_visible(v, rot) {
            v = rot.mult(v);
            var z = v.cell(2, 0);
            if (z <= 0) { return false; }
            if (v.cell(0, 0) * last_ratio > z) { return false; }
            if (v.cell(0, 0) * last_ratio < -z) { return false; }
            if (v.cell(1, 0) > z) { return false; }
            if (v.cell(1, 0) < -z) { return false; }
            return true;
        }

        function triangle_visible(nr, pos, rot) {
            var i, p, ret = 0;
            for (i = 0; i < 3; i += 1) {
                p = mesh[nr * 3 + i];
                if (point_visible(pos.add(p), rot)) {
                    ret += 1;
                }
            }
            return ret;
        }

        function triangle_draw(nr, pos, rot, texture) {
            prog.uniform_vec3("pos").set_matrix(pos);
            prog.uniform_mat3("rot").set_matrix(rot);
            texture.webgl_bind();
            prog.draw_triangles(nr * 3, 3);
        }

        function triangle_texture_pos(nr, tex_x, tex_y) {
            var v = mesh[nr * 3 + 1];
            if (tex_y < 1) {
                v = interpolate(
                    v,
                    mesh[nr * 3 + 2],
                    (tex_x - tex_y * 0.5) / (1 - tex_y)
                );
            }
            return interpolate(
                v,
                mesh[nr * 3],
                tex_y
            );
        }

        return {
            clear: function () {
                w.clear(0.4, 0.5, 1.0);
            },
            triangle_draw: triangle_draw,
            triangle_visible: triangle_visible,
            triangle_texture_pos: triangle_texture_pos,
            new_texture: w.new_texture
        };
    }

    function triangle_texture_updater(formula, nr, center, r1, r2,
            tex_size, triangle_texture_pos) {
        var c = document.createElement("canvas").getContext("2d"),
            opaque = true,
            empty = true,
            intersection = false,
            next_y = 0,
            next_x = 0;
        c.canvas.width = tex_size;
        c.canvas.height = tex_size;
        c.fillStyle = "rgb(0,0,0)";
        c.fillRect(0, 0, tex_size, tex_size);
        function step() {
            if (next_x < next_y * 0.5 - 1) {
                return false;
            }
            if (next_x > tex_size - next_y * 0.5 + 1) {
                return false;
            }
            var ray = triangle_texture_pos(nr, next_x / tex_size,
                    next_y / tex_size);
            ray = render_ray(
                formula,
                center.cell(0, 0),
                center.cell(1, 0),
                center.cell(2, 0),
                ray.cell(0, 0) * r1,
                ray.cell(1, 0) * r1,
                ray.cell(2, 0) * r1,
                1 / tex_size,
                r2 / r1,
                function () { intersection = true; }
            );
            if (ray) {
                if (typeof ray === "object") {
                    if (ray[0] < 0) { ray[0] = 0; }
                    if (ray[0] > 1) { ray[0] = 1; }
                    if (ray[1] < 0) { ray[1] = 0; }
                    if (ray[1] > 1) { ray[1] = 1; }
                    if (ray[2] < 0) { ray[2] = 0; }
                    if (ray[2] > 1) { ray[2] = 1; }
                    c.fillStyle = "rgb(" + Math.floor(255 * ray[0]) + "," +
                            Math.floor(255 * ray[1]) + "," +
                            Math.floor(255 * ray[2]) + ")";
                } else {
                    c.fillStyle = "rgb(127,127,127)";
                    intersection = true;
                }
                c.fillRect(next_x, next_y, 1, 1);
                empty = false;
            } else {
                opaque = false;
            }
            return true;
        }
        function steps() {
            var k = 0;
            while (k < 100) {
                if (next_y >= tex_size) {
                    return false;
                }
                if (step()) { k += 1; }
                next_x += 1;
                if (next_x >= tex_size) {
                    next_x = 0;
                    next_y += 1;
                }
            }
            return true;
        }
        return {
            step: steps,
            update_texture: function (texture) {
                if (next_y < tex_size) {
                    throw "Incomplete texture!";
                }
                texture.set_image(c.canvas);
            },
            triangle_info: function () {
                if (next_y < tex_size) {
                    throw "Incomplete triangle information!";
                }
                return {
                    center: center,
                    empty: empty,
                    opaque: opaque,
                    intersection: intersection,
                    radius: r1,
                    radius_outer: r2,
                    nr: nr,
                    texture_size: tex_size
                };
            }
        };
    }

    function renderer(formula) {
        var r = triangle_renderer(),
            updater,
            updater_index = -1,
            triangles = [],
            textures = [];

        function add_sphere(r1, r2) {
            var i;
            for (i = 0; i < 20; i += 1) {
                triangles.push({
                    center: matrix.vector([1000, 0, 0]),
                    nr: i,
                    empty: true,
                    radius: r1,
                    radius_outer: r2
                });
            }
        }

        function start_updater(index, pos, tex_size) {
            updater_index = index;
            updater = triangle_texture_updater(
                formula,
                triangles[index].nr,
                pos,
                triangles[index].radius,
                triangles[index].radius_outer,
                tex_size,
                r.triangle_texture_pos
            );
        }

        function updater_step(onupdate) {
            var i;
            if (updater.step()) {
                return true;
            }
            onupdate();
            triangles[updater_index] = updater.triangle_info();
            if (!triangles[updater_index].empty) {
                if (!textures[updater_index]) {
                    textures[updater_index] = r.new_texture();
                }
                updater.update_texture(textures[updater_index]);
            }
            for (i = updater_index - 20; i >= 0; i -= 20) {
                triangles[i].hidden = triangles[updater_index].opaque;
            }
            updater = undefined;
            return true;
        }

        function step(pos, rot, onupdate) {
            if (updater) {
                return updater_step(onupdate);
            }

            (function () {
                var i, d, remove = true;
                for (i = triangles.length - 20; i < triangles.length; i += 1) {
                    d = dist(pos, triangles[i].center) / triangles[i].radius;
                    if (triangles[i].intersection && (d < 0.01)) {
                        d = triangles[i].radius;
                        add_sphere(d * 0.5, d);
                        return;
                    }
                    if ((!triangles[i].empty) && (d < 0.5)) {
                        remove = false;
                    }
                }
                if (remove && (triangles.length > 20)) {
                    remove = false;
                    for (i = triangles.length - 20; i < triangles.length; i += 1) {
                        if (triangles[i].texture_size) {
                            remove = true;
                        }
                    }
                    if (remove) {
                        triangles.splice(-20, 20);
                        for (i = triangles.length - 20; i < triangles.length; i += 1) {
                            triangles[i].hidden = false;
                        }
                    }
                }
            }());

            var max_dist = -1000, max_i = -1, max_tex = -1;

            function check_triangle_stack(nr) {
                var i, d, v, tex;
                for (i = triangles.length - 20 + nr; i >= 0; i -= 20) {
                    tex = triangles[i].texture_size || 16;
                    d = dist(pos, triangles[i].center) / triangles[i].radius;
                    if (d > 0.5) { d = 0.5; }
                    if ((tex < 256) || (d > 0.00001)) {
                        v = d * 2;
                        v = v * v * 20;
                        v += 2 * Math.floor(i / 20) / triangles.length;
                        v -= Math.log(tex) / 3;
                        if ((v > max_dist) && (!triangles[i].hidden)) {
                            max_dist = v;
                            max_i = i;
                            max_tex = (d > 1 / tex) ? 32 : (tex * 2);
                        }
                    }
                }
            }

            (function () {
                var nr, v, skipped = [];
                for (nr = 0; nr < 20; nr += 1) {
                    v = r.triangle_visible(
                        nr,
                        matrix.vector([0, 0, 0]),
                        rot
                    );
                    if (v >= 1) {
                        check_triangle_stack(nr);
                    } else {
                        skipped.push(nr);
                    }
                }
                if (max_i < 0) {
                    for (nr = 0; nr < skipped.length; nr += 1) {
                        check_triangle_stack(skipped[nr]);
                    }
                }
            }());

            if (max_i >= 0) {
                start_updater(max_i, pos, max_tex);
                return true;
            }

            return false;
        }

        function draw_triangle(pos, rot, t, tex) {
            if (t.empty) { return; }
            if (t.hidden) { return; }
            if (dist(pos, t.center) > t.radius * 0.5) { return; }
            r.triangle_draw(
                t.nr,
                t.center.sub(pos).mult(
                    1 / t.radius
                ),
                rot,
                tex
            );
        }

        function draw_all(pos, rot) {
            var i;
            r.clear();
            for (i = 0; i < triangles.length; i += 1) {
                draw_triangle(pos, rot, triangles[i], textures[i]);
            }
        }

        function reset() {
            triangles = [];
            updater = undefined;
            updater_index = -1;
            add_sphere(0.7, 3.1);
        }

        reset();

        return {
            redraw: draw_all,
            step: step,
            scale: function () {
                return triangles[triangles.length - 1].radius;
            },
            set_formula: function (f) {
                formula = f;
                reset();
            }
        };
    }

    function view(formula_name, formula, cam_pos) {
        var r = renderer(formula),
            cam_rotm = matrix.identity(3),
            hash_update = false;

        function m_rotate(r, i) {
            var i1 = (i + 1) % 3, i2 = (i + 2) % 3;
            return matrix.identity(3).
                    set_cell(i1, i1, Math.cos(r)).
                    set_cell(i1, i2, Math.sin(r)).
                    set_cell(i2, i1, -Math.sin(r)).
                    set_cell(i2, i2, Math.cos(r));
        }

        setInterval(env.eventHandler(function () {
            if (hash_update) {
                hash_update = false;
                env.location().setHash(formula_name + ";" +
                        cam_pos.cell(0, 0) + ";" +
                        cam_pos.cell(1, 0) + ";" +
                        cam_pos.cell(2, 0) + ";v");
            }
        }), 1000);

        return {
            redraw: function (rx, ry, rz, movement) {
                cam_rotm = m_rotate(-rx, 0).
                        mult(m_rotate(ry, 1)).
                        mult(m_rotate(rz, 2));
                var d,
                    inv = m_rotate(-rz, 2).
                        mult(m_rotate(-ry, 1)).
                        mult(m_rotate(rx, 0));
                if ((movement.cell(0, 0) !== 0) ||
                        (movement.cell(1, 0) !== 0) ||
                        (movement.cell(2, 0) !== 0)) {
                    hash_update = true;
                    cam_pos = cam_pos.add(inv.mult(movement));
                }
                d = dist(cam_pos, matrix.vector([0, 0, 0]));
                if (d > 2) {
                    cam_pos = cam_pos.mult(2 / d);
                }
                r.redraw(cam_pos, cam_rotm);
            },
            step: function (onupdate) {
                return r.step(cam_pos, cam_rotm, onupdate);
            },
            scale: r.scale,
            set_formula: function (fn, f, pos) {
                formula_name = fn;
                r.set_formula(f);
                cam_pos = pos;
                cam_rotm = matrix.identity(3);
                hash_update = true;
            }
        };
    }

    function formula_list() {
        return {
            "mandelbulb": function (x, y, z) {
                x *= 1.3;
                y *= 1.3;
                z *= 1.3;
                var i, r, phi, theta, sinth, cx = x, cy = y, cz = z;
                for (i = 0; i < 1000; i += 1) {
                    r = Math.sqrt(x * x + y * y + z * z);
                    if (r > 1.3) { return false; }
                    phi = 8 * Math.atan2(z, x);
                    theta = 8 * Math.acos(y / r);
                    sinth = Math.sin(theta);
                    r = r * r;
                    r = r * r;
                    r = r * r;
                    x = r * sinth * Math.cos(phi) + cx;
                    y = r * Math.cos(theta) + cy;
                    z = r * sinth * Math.sin(phi) + cz;
                }
                r = Math.sqrt(x * x + y * y + z * z);
                return (r < 2);
            },
            "mandelbox": function (x, y, z) {
                x *= 11;
                y *= 11;
                z *= 11;
                var i, r, cx = x, cy = y, cz = z, dr = 1;
                for (i = 0; i < 100; i += 1) {
                    if (x > 1.0) {
                        x = 2.0 - x;
                    } else if (x < -1.0) {
                        x = -2.0 - x;
                    }
                    if (y > 1.0) {
                        y = 2.0 - y;
                    } else if (y < -1.0) {
                        y = -2.0 - y;
                    }
                    if (z > 1.0) {
                        z = 2.0 - z;
                    } else if (z < -1.0) {
                        z = -2.0 - z;
                    }
                    r = x * x + y * y + z * z;
                    if (r < 0.25) {
                        x = x * 4;
                        y = y * 4;
                        z = z * 4;
                    } else if (r < 1) {
                        x = x / r;
                        y = y / r;
                        z = z / r;
                    }
                    x = x * 2 + cx;
                    y = y * 2 + cy;
                    z = z * 2 + cz;
                    dr *= 2;
                }
                return Math.sqrt(x * x + y * y + z * z) * 100 < dr;
            }
        };
    }

    function init() {
        var v,
            prev_mousex = -1,
            prev_mousey = -1,
            movement = matrix.vector([0, 0, 0]),
            key_pressed = {},
            drawn = false,
            last_move_time = new Date().getTime(),
            lock_rotation = false,
            rot_z = 0,
            formulas = formula_list(),
            current_formula = "mandelbulb",
            current_pos = matrix.vector([0, 0, -1.1]);

        function move(t) {
            var speed = 0.6 * v.scale();
            if (key_pressed[87] || key_pressed.m) {
                movement = movement.set_cell(2, 0,
                        movement.cell(2, 0) + speed * t);
                drawn = false;
            }
            if (key_pressed[83]) {
                movement = movement.set_cell(2, 0,
                        movement.cell(2, 0) - speed * t);
                drawn = false;
            }
            if (key_pressed[65]) {
                movement = movement.set_cell(0, 0,
                        movement.cell(0, 0) - speed * t);
                drawn = false;
            }
            if (key_pressed[68]) {
                movement = movement.set_cell(0, 0,
                        movement.cell(0, 0) + speed * t);
                drawn = false;
            }
            if (key_pressed[81]) {
                rot_z += 0.5 * t;
                drawn = false;
            }
            if (key_pressed[69]) {
                rot_z -= 0.5 * t;
                drawn = false;
            }
        }

        function onframe() {
            var mx = env.mouse().getX() / env.canvas().width,
                my = env.mouse().getY() / env.canvas().height,
                t = new Date().getTime(),
                dt = (t - last_move_time) / 1000;
            move((dt > 0.1) ? 0.1 : dt);
            last_move_time = t;
            if (lock_rotation) {
                mx = prev_mousex;
                my = prev_mousey;
            }
            if ((mx < 0) || (my < 0)) {
                mx = 0.5;
                my = 0.5;
            }
            if ((mx !== prev_mousex) || (my !== prev_mousey) || (!drawn)) {
                prev_mousex = mx;
                prev_mousey = my;
                drawn = true;
                v.redraw(3 * (0.5 - my), 11 * (mx - 0.5), rot_z, movement);
                movement = matrix.vector([0, 0, 0]);
            }
            env.runOnNextFrame(onframe);
        }
        env.runOnNextFrame(onframe);

        function onidle() {
            if (v.step(function () { drawn = false; })) {
                env.runOnNextIdle(onidle);
            } else {
                env.runOnNextFrame(onidle);
            }
        }
        env.runOnNextIdle(onidle);

        function onhashchange() {
            var x, y, z, loc = env.location().getHash().split(";");
            if (loc.length < 4) { return; }
            x = parseFloat(loc[1]);
            y = parseFloat(loc[2]);
            z = parseFloat(loc[3]);
            if (!formulas[loc[0]]) { return; }
            if (isNaN(x)) { return; }
            if (isNaN(y)) { return; }
            if (isNaN(z)) { return; }
            drawn = false;
            current_formula = loc[0];
            current_pos = matrix.vector([x, y, z]);
            if (v && (loc[4] !== "v")) {
                v.set_formula(current_formula,
                    formulas[current_formula], current_pos);
            }
        }
        env.runOnLocationChange(onhashchange);
        onhashchange();

        env.runOnCanvasResize(function () {
            drawn = false;
            onframe();
        });

        document.body.onkeydown = env.eventHandler(function (ev) {
            if (ev.keyCode) {
                key_pressed[ev.keyCode] = true;
            }
        });

        document.body.onkeyup = env.eventHandler(function (ev) {
            if (ev.keyCode) {
                key_pressed[ev.keyCode] = undefined;
            }
            if (ev.keyCode === 32) {
                lock_rotation = !lock_rotation;
            }
        });

        env.canvas().onmousedown = env.eventHandler(function () {
            key_pressed.m = true;
        });

        env.canvas().onmouseup = env.eventHandler(function () {
            key_pressed.m = false;
        });

        (function () {
            var i, s = env.menu().addSubmenu("Fractal");
            for (i in formulas) {
                if (formulas.hasOwnProperty(i)) {
                    s.addLink(
                        i[0].toUpperCase() + i.substring(1),
                        "#" + i + ";0;0;-1.1"
                    );
                }
            }
        }());

        v = view(current_formula, formulas[current_formula], current_pos);
    }

    init();
}
