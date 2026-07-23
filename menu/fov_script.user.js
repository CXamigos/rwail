// ==UserScript==
// @name         Arras.io FOV Factor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @match        *://arras.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let raZor = 1.0;
    
    window.addEventListener("wheel", (raZOA) => {
        raZOA.preventDefault();
        raZor *= (raZOA.deltaY < 0 ? 0.9 : 1.1);
        raZor = Math.min(30, Math.max(0.1, raZor));
    }, { passive: false });

    const rAzor = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
    Object.defineProperty(MessageEvent.prototype, 'data', {
        get: function() {
            let raz_or = rAzor.get.call(this);
            if (raz_or instanceof ArrayBuffer) {
                let raZOr = new Uint8Array(raz_or);
                let rAzOr = new DataView(raz_or);
                if (raZOr[0] === 117) {
                    let raZOar = 1;
                    while (raZOar < raZOr.length - 15) {
                        if (raZOr[raZOar] === 255 && raZOr[raZOar + 5] === 255 && raZOr[raZOar + 10] === 255) {
                            let razor = rAzOr.getFloat32(raZOar + 11, true);
                            if (razor > 50 && razor < 100000) {
                                rAzOr.setFloat32(raZOar + 11, razor * raZor, true);
                            }
                        }
                        raZOar++;
                    }
                }
            }
            return raz_or;
        }
    });
})();
