/**
 * Semicircle extension for L.Circle.
 * Jan Pieter Waagmeester <jieter@jieter.nl>
 *
 * This version is tested with leaflet 1.0.2
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['leaflet'], factory);
    } else if (typeof module !== 'undefined' && typeof require !== 'undefined') {
        // Node/CommonJS
        module.exports = factory(require('leaflet'));
    } else {
        // Browser globals
        if (typeof window.L === 'undefined') {
            throw 'Leaflet must be loaded first';
        }
        factory(window.L);
    }
})(function (L) {
    var DEG_TO_RAD = Math.PI / 180;

    // make sure 0 degrees is up (North) and convert to radians.
    function fixAngle (angle) {
        return (angle - 90) * DEG_TO_RAD;
    }

    // rotate point [x + r, y+r] around [x, y] by `angle` radians.
    function rotated (p, angle, r, r2) {
        if (Math.cos(angle) == 0.0) {
            angle2 = angle;
        } else {
            angle2 = Math.atan(r / r2 * Math.tan(angle));
            if (Math.cos(angle) < 0) angle2 += Math.PI;
        }
        return p.add(
            L.point(Math.cos(angle2) * r, Math.sin(angle2) * r2)
        );
    }

    L.Point.prototype.rotated = function (angle, r, r2) {
        return rotated(this, angle, r, r2);
    };

    var semicircle = {
        options: {
            startAngle: 0,
            stopAngle: 359.9999,
            arc: false
        },

        startAngle: function () {
            if (this.options.startAngle < this.options.stopAngle) {
                return fixAngle(this.options.startAngle);
            } else {
                return fixAngle(this.options.stopAngle);
            }
        },
        stopAngle: function () {
            if (this.options.startAngle < this.options.stopAngle) {
                return fixAngle(this.options.stopAngle);
            } else {
                return fixAngle(this.options.startAngle);
            }
        },

        setStartAngle: function (angle) {
            this.options.startAngle = angle;
            return this.redraw();
        },

        setStopAngle: function (angle) {
            this.options.stopAngle = angle;
            return this.redraw();
        },

        setDirection: function (direction, degrees) {
            if (degrees === undefined) {
                degrees = 10;
            }
            this.options.startAngle = direction - (degrees / 2);
            this.options.stopAngle = direction + (degrees / 2);

            return this.redraw();
        },
        getDirection: function () {
            return this.stopAngle() - (this.stopAngle() - this.startAngle()) / 2;
        },

        isSemicircle: function () {
            var startAngle = this.startAngle(),
                stopAngle = this.stopAngle();

            return (
                !(stopAngle >= startAngle + 2 * Math.PI) &&
                !(startAngle == stopAngle)
            );
        },
        _containsPoint: function (p) {
            function normalize (angle) {
                while (angle <= -Math.PI) {
                    angle += 2.0 * Math.PI;
                }
                while (angle > Math.PI) {
                    angle -= 2.0 * Math.PI;
                }
                return angle;
            }
            var angle = Math.atan2(p.y - this._point.y, p.x - this._point.x);
            var nStart = normalize(this.startAngle());
            var nStop = normalize(this.stopAngle());
            if (nStop <= nStart) {
                nStop += 2.0 * Math.PI;
            }
            if (angle <= nStart) {
                angle += 2.0 * Math.PI;
            }
            return (
                nStart < angle && angle <= nStop &&
                p.distanceTo(this._point) <= this._radius + this._clickTolerance()
            );
        }
    };

    L.SemiCircle = L.Circle.extend(semicircle);
    L.SemiCircleMarker = L.CircleMarker.extend(semicircle);

    L.semiCircle = function (latlng, options) {
        return new L.SemiCircle(latlng, options);
    };
    L.semiCircleMarker = function (latlng, options) {
        return new L.SemiCircleMarker(latlng, options);
    };

    var _updateCircleSVG = L.SVG.prototype._updateCircle;
    var _updateCircleCanvas = L.Canvas.prototype._updateCircle;

    L.SVG.include({
        _updateCircle: function (layer) {
            // If we want a circle, we use the original function
            if (!(layer instanceof L.SemiCircle || layer instanceof L.SemiCircleMarker) ||
                !layer.isSemicircle()) {
                return _updateCircleSVG.call(this, layer);
            }
            if (layer._empty()) {
                return this._setPath(layer, 'M0 0');
            }

            var p0 = layer._map.latLngToLayerPoint(layer._latlng),
                p1 = layer._point,
                r = Math.max(Math.round(layer._radius), 1),
                r2 = Math.max(Math.round(layer._radiusY), 1) || r,
                arc = 'A' + r + ',' + r2 + ' 0 ',
                start = p1.rotated(layer.startAngle(), r, r2),
                end = p1.rotated(layer.stopAngle(), r, r2);

            var largeArc = (layer.stopAngle() - layer.startAngle() >= Math.PI) ? '1' : '0';


            var d = !L.Browser.vml ?
                    !layer.options.arc ?
                    'M' + p0.x + ',' + p0.y +
                    // line to first start point
                    'L' + start.x + ',' + start.y +
                    arc + largeArc + ',1 ,' + end.x + ',' + end.y + ' z' :
                    // arc
                    'M' + start.x + ',' + start.y +
                    arc + largeArc + ',1 ,' + end.x + ',' + end.y :
                  //  VML for IE8
                    !layer.options.arc ?
                    'M' + p0.round().x + ',' + p0.round().y + ' ' +
                    'AE ' + p1.round().x + ',' + p1.round().y + ' ' + r + ',' + r2 + ' ' +
                    (65535 * (90 - layer.options.stopAngle)) + ',' +
                    (65535 * (layer.options.stopAngle - layer.options.startAngle)) + ' x':
                    // arc
                    'AL ' + p1.round().x + ',' + p1.round().y + ' ' + r + ',' + r2 + ' ' +
                    (65535 * (90 - layer.options.stopAngle)) + ',' +
                    (65535 * (layer.options.stopAngle - layer.options.startAngle));

            this._setPath(layer, d);
        }
    });

    L.Canvas.include({
        _updateCircle: function (layer) {
            // If we want a circle, we use the original function
            if (!(layer instanceof L.SemiCircle || layer instanceof L.SemiCircleMarker) ||
                !layer.isSemicircle()) {
                return _updateCircleCanvas.call(this, layer);
            }
            if (!this._drawing || layer._empty()) { return; }

            var p0 = layer._map.latLngToLayerPoint(layer._latlng),
                p1 = layer._point,
                ctx = this._ctx,
                r = Math.max(Math.round(layer._radius), 1),
                s = (Math.max(Math.round(layer._radiusY), 1) || r)  / r;

            this._drawnLayers[layer._leaflet_id] = layer;

            if (s !== 1) {
                ctx.save();
                ctx.scale(1, s);
            }

            ctx.beginPath();
            if (!layer.options.arc) { ctx.moveTo(p0.x, p0.y); }
            ctx.arc(p1.x, p1.y / s, r, layer.startAngle(), layer.stopAngle(), false);
            if (!layer.options.arc) { ctx.lineTo(p0.x, p0.y); }

            if (s !== 1) {
                ctx.restore();
            }

            this._fillStroke(ctx, layer);
        }
    });
});
