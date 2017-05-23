import _ from 'underscore';
import uuid from 'uuid';
import  Node from 'nodik-zmq';
import loki from 'lokijs';
import childProcess from 'child_process';

import globals from './globals';
import utils from './utils';

let {EVENTS, LAYERS} = globals;

// ** Loki DB collections
let db = new loki('./db/kitoo.json');

let RouterCollection = db.addCollection('executor-routers', {unique: ['id', 'name']});
let ServiceCollection = db.addCollection('executor-services', {unique: ['id', 'name']});
let PackCollection = db.addCollection('executor-packs', {unique: ['name']});

let _private = new WeakMap();

export default class Executor extends Node {
    constructor(data = {}) {
        let {layer, bind, dns} = data;
        super({layer});

        let _scope = {};
        _scope.executorManager = new ExecutorManager(this);
        _scope.dnsAddress = dns;
        _scope.bindAddress = bind;
        _private.set(this, _scope);
    }

    // TODO @avar dnsHost and bind default values, and we also have them in constructor
    async start(dnsHost, bind = 6001) {
        let _scope = _private.get(this);
        _scope.dnsAddress = dnsHost ? dnsHost : _scope.dnsAddress;
        _scope.bindAddress = _.isNumber(bind) ?  `tcp://127.0.0.1:${bind}` : bind;
        
        await super.bind(_scope.bindAddress);
        await super.connect(_scope.dnsAddress);
        _scope.executorManager.init();
        _scope.started = Date.now();
        _scope.status = 'online';
        this.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.START, this.toJSON());
        return this;
    }

    async stop() {
        let _scope = _private.get(this);
        await this.disconnect(_scope.dnsAddress);
        await this.unbind();
        _scope.executorManager.destroy();
        return true;
    }

    toJSON () {
        let _scope = _private.get(this);
        return {
            id: this.getId(),
            layer: this.getLayer(),
            status: _scope.status,
            started : _scope.started
        };
    }
}

class ExecutorManager {
    constructor(executor) {
        let _scope = {
            executor : executor,
            serviceProcessMap: {}
        };

        _private.set(this,_scope);
    }

    init() {
        let executor = _private.get(this).executor;

        let proxyToLayer = (layer, event) => {
            return (data) => {
                executor.tickLayer(layer, event, data);
            }
        };

        // ** PROXIES EXPECTING FROM SERVICE LAYER
        executor.onTick(EVENTS.SERVICE.START, proxyToLayer(LAYERS.DNS, EVENTS.SERVICE.START));
        executor.onTick(EVENTS.SERVICE.STOP,  proxyToLayer(LAYERS.DNS, EVENTS.SERVICE.STOP));
        executor.onTick(EVENTS.SERVICE.FAIL,  proxyToLayer(LAYERS.DNS, EVENTS.SERVICE.FAIL));

        // ** PROXIES EXPECTING FROM DNS LAYER
        executor.onTick(EVENTS.DNS.ROUTER_START, proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_START));
        executor.onTick(EVENTS.DNS.ROUTER_STOP,  proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_STOP));
        executor.onTick(EVENTS.DNS.ROUTER_FAIL,  proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_FAIL));

        // ** Service compile and management - up/down, restart, info
        executor.onTick(EVENTS.AGENT.SERVICE_UP, this::serviceUpHandler);
        executor.onTick(EVENTS.AGENT.SERVICE_DOWN, this::serviceDownHandler);
        executor.onTick(EVENTS.AGENT.SERVICE_RESTART, this::serviceRestartHandler);
        executor.onTick(EVENTS.AGENT.SERVICE_STATUS, this::serviceStatusHandler);
        executor.onTick(EVENTS.AGENT.SERVICE_PACK_START, this::servicePackHandler);
        executor.onTick(EVENTS.AGENT.SERVICE_INSTALL_START, this::serviceInstallHandler);
    }

    destroy () {
        let executor = _private.get(this).executor;
        executor.offTick(EVENTS.SERVICE.START);
        executor.offTick(EVENTS.SERVICE.STOP);
        executor.offTick(EVENTS.SERVICE.FAIL);

        executor.offTick(EVENTS.DNS.ROUTER_START);
        executor.offTick(EVENTS.DNS.ROUTER_STOP);
        executor.offTick(EVENTS.DNS.ROUTER_FAIL);

        executor.offTick(EVENTS.AGENT.NOTIFY);
        executor.offTick(EVENTS.AGENT.SERVICE_UP);
        executor.offTick(EVENTS.AGENT.SERVICE_DOWN);
        executor.offTick(EVENTS.AGENT.SERVICE_RESTART);
        executor.offTick(EVENTS.AGENT.SERVICE_STATUS);
        executor.offTick(EVENTS.AGENT.SERVICE_PACK_START);
        executor.offTick(EVENTS.AGENT.SERVICE_INSTALL_START);
    }
}

// ** Private functions of ServiceManager

async function serviceUpHandler(servicePack) {
    let _scope = _private.get(this);
    let serviceName = servicePack.name;

    let service = PackCollection.findOne( {'name':serviceName});
    if(!service) {
        PackCollection.insert({'name':serviceName, executor : _scope.executor.toJSON()});
        service = PackCollection.findOne( {'name':serviceName});
    }

    // ** UNPACKING THE SERVICE
    if(!service.packed) {
        await servicePackHandler(servicePack);
    }


    // ** NPM INSTALL THE SERVICE
    if(!service.installed) {
        await this::serviceCompileHandler(serviceName);
    }
    // ** FORK THE SERVICE ON EXECUTOR
    await this::serviceForkHandler(serviceName);
}

async function serviceDownHandler(downgradeConfig) {

}

async function serviceRestartHandler() {

}

async function serviceStatusHandler() {

}

async function serviceForkHandler(name) {
    let _scope = _private.get(this);
    let executor = _scope.executor;

    let service = PackCollection.findOne( {'name':name, installed: true });
    if(!service || !service.installed) {
        // ** if we don't have compiled service lets just notify dns
        let errTxt = `Service ${name} is not installed on executor ${executor.getIdentity()}'`;
        executor.tickLayer(LAYERS.AGENT, EVENTS.AGENT.NOTIFY, errTxt);
        throw new Error(errTxt);
    }

    let serviceIdentity = uuid.v4();
    let executorId = executor.getId();
    let executorHost = executor.getAddress();
    let forkArgs = ['--kitoo::sid', serviceIdentity, '--kitoo::exid', executorId, '--kitoo::exhost', executorHost];
    console.info(`Forking service ${name} on executor ${executorId}, service identity: ${serviceIdentity}`);
    let serviceProcess = childProcess.fork(name, forkArgs, { env: process.env, cwd: servicePath, shell : true });
    _scope.serviceProcessMap[serviceIdentity] = serviceProcess;
}

async function servicePackHandler(servicePack) {
    let _scope = _private.get(this);
    let executor = _scope.executor;

    let serviceName = servicePack.name;
    console.info(`Service '${serviceName} unpacking started ....'`, Date.now());
    await utils.unpackService(servicePack);
    console.info(`Service '${serviceName} unpacking finished'`, Date.now());

    let service = PackCollection.findOne( {'name':serviceName, packed: true});
    if(!service || !service.packed) {
        let errTxt = `Service ${name} is not packed on executor ${executor.getId()}`;
        executor.tickLayer(LAYERS.AGENT, EVENTS.AGENT.NOTIFY, errTxt);
        throw new Error(errTxt);
    }
    service.packed = Date.now();
    PackCollection.update(service);

    executor.tickLayer(LAYERS.AGENT, EVENTS.AGENT.SERVICE_PACK_FINISH, service);
}

async function serviceInstallHandler(serviceName) {
    let _scope = _private.get(this);
    let executor = _scope.executor;
    console.info(`Service '${serviceName} install started ....'`, Date.now());
    await utils.npmInstallService(serviceName);
    console.info(`Service '${serviceName} install finished'`, Date.now());

    let service = PackCollection.findOne( {'name':serviceName, packed: true});
    if(!service || !service.packed) {
        let errTxt = `Service ${name} is not packed on executor ${executor.getIdentity()}`;
        executor.tickLayer(LAYERS.AGENT, EVENTS.AGENT.NOTIFY, errTxt);
        throw new Error(errTxt);
    }
    service.installed = Date.now();

    PackCollection.update(service);

    executor.tickLayer(LAYERS.AGENT, EVENTS.AGENT.SERVICE_INSTALL_FINISH, service);
}