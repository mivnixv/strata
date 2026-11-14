import test from 'node:test';
import assert from 'node:assert/strict';
import { grayscalePixels } from '../src/icons/tint.js';
test('tints grayscale art while preserving colored icons',()=>{
 assert.equal(grayscalePixels([0,0,0,255,128,128,128,255,255,255,255,255]),true);
 assert.equal(grayscalePixels([0,100,200,0,125,128,130,200]),true);
 assert.equal(grayscalePixels([20,90,200,255]),false);
 assert.equal(grayscalePixels([0,0,0,0]),false);
});
