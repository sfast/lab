/**
 * Created by artak on 2/22/17.
 */
import _ from 'underscore';
import Node from 'nodik-zmq';
import loki from 'lokijs';
import readConfig from 'read-config';
import debugFactory from 'debug';

import globals from './globals';

let debug = debugFactory('kitoo::dns');
let kitooConfigOptions = readConfig(path.resolve(`${__dirname}/.kitoo`');
let {EVENTS, LAYERS} = globals;
let db = new loki('./db/kitoo.json');

let ExecutorCollection = db.addCollection('dns-executors',  { unique: ['id','name']});
let ServiceCollection = db.addCollection('dns-services',  { unique: ['id', 'name']});
let ExecutorPackCollection = db.addCollection('dns-executorpacks',  { unique: ['id']});

let _private = new WeakMap();

export default class Dns extends Node {
    constructor({bind}) {
        super({layer: LAYERS.DNS});

        let _scope = {
            executorManager: new ExecutorManager(this),
            bindAddress: bind
        };

        _private.set(this, _scope);
    }

    async start(bindAddress) {
        let _scope = _private.get(this);
        if(bindAddress) {
            _scope.bindAddress = bindAddress;
        }

        await super.bind(_scope.bindAddress);
        _scope.executorManager.init();
    }

    async stop() {
        let _scope = _private.get(this);
        await super.unbind();
        _scope.executorManager.destroy();
    }
}

class ExecutorManager {
    constructor(dns){
        let _scope = {
            dns: dns
        };

        _private.set(this, _scope);
    }

    init() {
        let dns = _private.get(this).dns;
        dns.onTick(EVENTS.EXECUTOR.START, this::executorStartHandler);
        dns.onTick(EVENTS.EXECUTOR.STOP, this::executorStopHandler);
        dns.onTick(EVENTS.EXECUTOR.FAIL, this::executorStopHandler);

        dns.onTick(EVENTS.EXECUTOR.SERVICE_PACK_FINISH, this::servicePackFinishdHandler);
        dns.onTick(EVENTS.EXECUTOR.SERVICE_COMPILE_FINISH, this::serviceCompileFinishdHandler);

        dns.onTick(EVENTS.SERVICE.START, this::serviceStartHandler);
        dns.onTick(EVENTS.SERVICE.STOP, this::serviceStopHandler);
        dns.onTick(EVENTS.SERVICE.FAIL, this::serviceStopHandler);
    }

    destroy(){
        let dns = _private.get(this).dns;
        dns.offTick(events.EXECUTOR.START);
        dns.offTick(events.EXECUTOR.STOP);

        dns.offTick(events.SERVICE.START);
        dns.offTick(events.SERVICE.STOP);
    }

    getServiceInfo(serviceName) {
        let _scope = _private.get(this);

        let qty = 0;
        _scope.executorList.forEach((executorItem, executorId) => {
            qty += executorItem.hasRunningService(serviceName);
        });

        return {count : qty};
    }

    tryToRunServiceOnExecutor(executorId, serviceName) {
        console.log(`Try to run ${executorId} ${serviceName}`);
        let executorNode = _private.get(this).executorList.get(executorId);
        if(executorNode && executorNode.isOnline()) {
            if(!executorNode.hasCompiledService(serviceName)) {
                let servicePack = Commands.ServiceCommand.packService(serviceName);
                // { executor : executorId, pack: servicePack }
                this.tick(executorId, events.SERVICE.COMPILE, servicePack);
            } else {
                this.tick(executorId, events.SERVICE.RUN, {count: 1, name : serviceName});
            }
        }
        else {
            console.error(`Cant run service ${serviceName} on ${executorId}`);
        }
    }

    getOnlineExecutors(){
        let onlineExecutorIds = [];
        _private.get(this).executorList.values().forEach((executorItem) => {
            let identity = executorItem.getIdentity();
            onlineExecutorIds.push(identity);
        });

        return onlineExecutorIds;
    }

    isExecutorOnline(executorId) {
        let executorNode = _private.get(this).executorList.get(executorId);
        return executorNode && executorNode.isOnline() ? executorNode  : false;
    }

    hasExecutorCompiledService(executorId, serviceName) {
        let executorNode = _private.get(this).executorList.get(executorId);
        return executorNode ? executorNode.hasCompiledService(serviceName) : false;
    }
}

// ** Executor Handlers

function executorStartHandler(data = {}) {
    let {id, layer, status, started} = data;
    let _scope = _private.get(this);
    debug(`EXECUTOR.READY ${id}`);
    ExecutorCollection.findAndRemove({id: id});
    ExecutorCollection.insert(data);
}

function executorStopHandler (id) {
    console.info(`Executor ${id} is stopped, setting it to offline`);
    let _scope = _private.get(this);
    let executor = ExecutorCollection.findOne({id: id});

    ExecutorCollection.findAndUpdate({id: id}, (item) => {
        item.status = 'offline';
    });
}

function serviceStartHandler(data = {}) {
    let _scope = _private.get(this);
    let {id, name, layer, executorId, executorHost, status, started} = data;
    console.log(`Service ${name} : ${id} is running on executor id: ${executorId}, host: ${executorHost}`);
    ServiceCollection.insert(data);
}

function serviceStopHandler(id) {
    let service = ServiceCollection.findOne({id:id});
    console.info(`Service ${id} (${service.name}) stopped`);

    ServiceCollection.findAndUpdate({id: id}, (item) => {
        item.status = 'offline';
    });
}

function servicePackFinishdHandler(data = {}) {
    ExecutorPackCollection.update(data);
}

function serviceCompileFinishdHandler(data = {}) {
    ExecutorPackCollection.update(data);
}

/*
 function _anythingToRun(){
 let _scope = _private.get(this);
 let compiledServices = Commands.ServiceCommand.getAllServices();
 console.log(compiledServices);
 // compiledServices.forEach( (serviceName) => {
 //     let serviceRunCount = Math.max(_defaultOptions.any, _defaultOptions[serviceName] || 0);
 //     let serviceItemInfo = this.getServiceInfo(serviceName);
 //     if(serviceItemInfo.count < serviceRunCount) {
 //         let remainingCount = serviceRunCount - serviceItemInfo.count;
 //         for(let i = 0; i < remainingCount; i++) {
 //             let executorId = _scope.executorList.values()[0].getIdentity();
 //             console.log(`Kitoo - there is service ${serviceName} to run, remaining: ${remainingCount}`);
 //             this.emitToChild(executorId, events.SERVICE.RUN,  {name : serviceName, count : remainingCount});
 //         }
 //     }
 // });
 }
 */