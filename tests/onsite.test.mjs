import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Playback} from '../playback.mjs';
import {encodeOSC,decodeOSC,validateConfig} from '../osc.mjs';
const durations=JSON.parse(readFileSync(new URL('../playback.json',import.meta.url))).durations;

test('play reaches Scene 3 and remains there until animation is requested',()=>{
 const p=new Playback(durations);
 p.action('play',0);p.observe({sceneIndex:0,view:1},0);
 assert.equal(p.due(durations[0]*1000-1,true),null);
 assert.equal(p.due(durations[0]*1000,true),1);
 p.observe({sceneIndex:1,view:1},21000);
 assert.equal(p.due(29000,true),2);
 p.observe({sceneIndex:2,view:1},29000);
 assert.equal(p.due(999999,true),null);
 assert.equal(p.snapshot(999999,true).waitingHand,true);
});
test('animation advances through Scene 5 then requests reset, not Scene 1',()=>{
 const p=new Playback(durations);p.action('animation',0);
 p.observe({sceneIndex:3,view:1},0);
 assert.equal(p.due(13000,true),4);
 p.observe({sceneIndex:4,view:1},13000);
 assert.equal(p.due(13000+durations[4]*1000,true),-1);
 assert.equal(p.sequence,'reset');assert.equal(p.automatic,false);
 assert.equal(p.due(999999,true),null);
});
test('disconnected, NO_VIEW and unconfirmed scene changes do not advance',()=>{
 const p=new Playback(durations);p.action('play',0);
 assert.equal(p.due(999999,true),null);
 p.observe({sceneIndex:0,view:1},0);
 assert.equal(p.due(999999,false),null);
 p.observe({sceneIndex:0,view:0},1);
 assert.equal(p.due(999999,true),null);
});
test('OSC packet matches the wire format used for play sequence',()=>{
 const packet=encodeOSC('/ac/sequence',[0]);
 assert.equal(packet.toString('hex'),'2f61632f73657175656e6365000000002c69000000000000');
 assert.deepEqual(decodeOSC(packet),{address:'/ac/sequence',args:[0]});
 assert.throws(()=>decodeOSC(packet.subarray(0,packet.length-1)));
});
test('onsite target config is valid and Pages entries contain identical controls',()=>{
 const config=JSON.parse(readFileSync(new URL('../config.json',import.meta.url)));
 assert.deepEqual(validateConfig(config),config);
 assert.deepEqual(readFileSync(new URL('../index.html',import.meta.url)),readFileSync(new URL('../A_ZONE_OSC.html',import.meta.url)));
});
