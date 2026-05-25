"use strict";
const obj = Object.freeze({ a: 1 });
try {
  obj.a = 2;
  console.log("Mutable!");
} catch (e) {
  console.log("Immutable! " + e.message);
}
