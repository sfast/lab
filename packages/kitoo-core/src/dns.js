/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore';
import path from 'path'
import Node from 'nodik-zmq';
import loki from 'lokijs';
import readConfig from 'read-config';
import debugFactory from 'debug';

import globals from './globals';

let debug = debugFactory('kitoo::dns');

let {EVENTS, LAYERS} = globals;
let db = new loki('./db/kitoo.json');

let ExecutorCollection = db.addCollection('dns-executors',  { unique: ['id','name']});
let ServiceCollection = db.addCollection('dns-services',  { unique: ['id', 'name']});

let kitooLog = (data) => {
    console.log(data);
};

let _private = new WeakMap();

export default class Dns extends Node {
    constructor(data = {}) {
        let {bind, port} = data;
        super({layer: LAYERS.DNS});

        let _scope = {
            dnsManager: new DnsManager(this),
            bind: bind,
            port: port
        };

        _private.set(this, _scope);
    }

    async start(data = {}) {
        let _scope = _private.get(this);
        let {bind, port} = data;
        if(bind) {
            _scope.bind = bind;
        }
        if(port) {
            _scope.port = port;
        }

        await super.bind(`${_scope.bind}:${_scope.port}`);
        _scope.dnsManager.init();
    }

    async stop() {
        let _scope = _private.get(this);
        await super.unbind();
        _scope.dnsManager.destroy();
    }
}

class DnsManager {
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

        dns.onTick(EVENTS.SERVICE.START, this::serviceStartHandler);
        dns.onTick(EVENTS.SERVICE.STOP, this::serviceStopHandler);
        dns.onTick(EVENTS.SERVICE.FAIL, this::serviceStopHandler);

        dns.onTick(EVENTS.AGENT.NOTIFY, (data) => {console.log(data)});
        dns.onTick(EVENTS.AGENT.SERVICE_UP,  this::serviceUpHandler());
        dns.onTick(EVENTS.AGENT.SERVICE_DOWN,  this::serviceDownHandler());
        dns.onTick(EVENTS.AGENT.SERVICE_RESTART,  this::serviceRestartHandler());
        dns.onTick(EVENTS.AGENT.SERVICE_STATUS,  this::serviceStatusHandler());
    }

    destroy(){
        let dns = _private.get(this).dns;

        dns.offTick(EVENTS.EXECUTOR.START);
        dns.offTick(EVENTS.EXECUTOR.STOP);
        dns.offTick(EVENTS.EXECUTOR.FAIL);

        dns.offTick(EVENTS.SERVICE.START);
        dns.offTick(EVENTS.SERVICE.STOP);
        dns.offTick(EVENTS.SERVICE.FAIL);

        dns.offTick(EVENTS.AGENT.NOTIFY);
        dns.offTick(EVENTS.AGENT.SERVICE_UP);
        dns.offTick(EVENTS.AGENT.SERVICE_DOWN);
        dns.offTick(EVENTS.AGENT.SERVICE_RESTART);
        dns.offTick(EVENTS.AGENT.SERVICE_STATUS);
    }

    getOnlineExecutors(){

        let onlineExecutorIds = [];

        let executors = ExecutorCollection.find({state: 'online'});
        return executors.map((executorItem) => {
            return executorItem.state == 'online';
        });
    }

    getAnyOnlineExecutor() {
        let onlineExecutors = this.getOnlineExecutors();
        return onlineExecutors[Math.floor(Math.random()*onlineExecutors.length)];
    }

    isExecutorOnline(executorId) {
        let executor = ExecutorCollection.findOne({id: executorId});
        if(!executor) {
            throw new Error(`Executor ${executorId} is not found.`);
        }

        return executor.state == 'online';
    }

    getServiceInfo(serviceName) {
        let serviceMonitor = { name : serviceName, online: 0, executors : {}};
        let services = ServiceCollection.find({name : serviceName});
        if(!services) {
            services = [];
        }

        services.forEach((serviceItem) => {
            serviceMonitor.online +=1;
        });

        return serviceMonitor;
    }
}

// ** Executor Handlers

let executorStartHandler = (data = {}) => {
    let {id, layer, status, started} = data;
    let _scope = _private.get(this);
    debug(`EXECUTOR.START ${id}`);
    ExecutorCollection.findAndRemove({id: id});
    ExecutorCollection.insert(data);
};

let executorStopHandler = (id) => {
    console.info(`Executor ${id} is stopped, setting it to offline`);
    let _scope = _private.get(this);
    let executor = ExecutorCollection.findOne({id: id});

    ExecutorCollection.findAndUpdate({id: id}, (item) => {
        item.status = 'offline';
    });
}

// ** Service Handlers

let serviceStartHandler = (data = {}) => {
    let _scope = _private.get(this);
    let {id, name, layer, executorId, executorHost, status, started} = data;
    console.log(`Service ${name} : ${id} is running on executor id: ${executorId}, host: ${executorHost}`);
    ServiceCollection.insert(data);
};

let serviceStopHandler = (id) => {
    let service = ServiceCollection.findOne({id:id});
    console.info(`Service ${id} (${service.name}) stopped`);

    ServiceCollection.findAndUpdate({id: id}, (item) => {
        item.status = 'offline';
    });
};

// ** Agent Handlers

let serviceUpHandler = (data = {}) => {
    let {name, pack, executor} = data;
    let dns = _private.get(this).dns;
    let onlineExecutors = dns.getOnlineExecutors();
    if (!onlineExecutors.length) {
        let errTxt = `Can't run service '${name}, no online executors found`;
        dns.tickLayer(LAYERS.AGENT, EVENTS.AGENT.NOTIFY, errTxt);
        throw new Error(errTxt);
    }

    if (executor && onlineExecutors.indexOf(executor) == -1) {
        let errTxt = `Can't run service '${name}, can't find executor ${executor} under online executors list`;
        dns.tickLayer(LAYERS.AGENT, EVENTS.AGENT.NOTIFY, errTxt);
        throw new Error(errTxt);
    }

    if(!executor) {
        // ** get Random Executor
        executor = dns.getAnyOnlineExecutor();
    }

    console.log(`Trying to run service ${name} on worker ${executor}`);
    dns.tick(executor, EVENTS.AGENT.SERVICE_UP, pack);
};

let serviceDownHandler = () => {

};

let serviceRestartHandler = () => {

};

let serviceStatusHandler = () => {

};

