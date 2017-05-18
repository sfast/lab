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
let ServicePackCollection = db.addCollection('executor-servicepacks', {unique: ['name']});

let _private = new WeakMap();

export default class Executor extends Node {
    constructor(data = {}) {
        let {layer, bind, dns} = data;
        super({layer});

        let _scope = {};
        _scope.serviceManager = new ServiceManager(this);
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
        _scope.serviceManager.init();
        _scope.started = Date.now();
        _scope.status = 'online';
        this.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.START, this.toJSON());
        return this;
    }

    async stop() {
        let _scope = _private.get(this);
        await this.disconnect(_scope.dnsAddress);
        await this.unbind();
        _scope.serviceManager.destroy();
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

class ServiceManager {
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
        executor.onTick(EVENTS.SERVICE.STOP, proxyToLayer(LAYERS.DNS, EVENTS.SERVICE.STOP));
        executor.onTick(EVENTS.SERVICE.FAIL, proxyToLayer(LAYERS.DNS, EVENTS.SERVICE.FAIL));

        // ** PROXIES EXPECTING FROM DNS LAYER
        executor.onTick(EVENTS.DNS.ROUTER_START, proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_START));
        executor.onTick(EVENTS.DNS.ROUTER_STOP, proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_STOP));
        executor.onTick(EVENTS.DNS.ROUTER_FAIL, proxyToLayer(LAYERS.SERVICE, EVENTS.DNS.ROUTER_FAIL));

        // ** Service compile and management - up/down, restart, info
        executor.onTick(EVENTS.DNS.SERVICE_PACK_START, this::servicePackHandler);
        executor.onTick(EVENTS.DNS.SERVICE_COMPILE_START, this::serviceCompileHandler);
        executor.onTick(EVENTS.DNS.SERVICE_UP, this::serviceUpHandler);
        executor.onTick(EVENTS.DNS.SERVICE_DOWN, this::serviceDownHandler);
    }

    destroy () {
        let executor = _private.get(this).executor;
        executor.offTick(EVENTS.SERVICE.START);
        executor.offTick(EVENTS.SERVICE.STOP);
        executor.offTick(EVENTS.SERVICE.FAIL);

        executor.offTick(EVENTS.DNS.ROUTER_START);
        executor.offTick(EVENTS.DNS.ROUTER_STOP);
        executor.offTick(EVENTS.DNS.ROUTER_FAIL);

        executor.offTick(EVENTS.DNS.SERVICE_PACK_START);
        executor.offTick(EVENTS.DNS.SERVICE_COMPILE_START);
        executor.offTick(EVENTS.DNS.SERVICE_UP);
        executor.offTick(EVENTS.DNS.SERVICE_DOWN);

    }
}

// ** Private functions of ServiceManager

let servicePackHandler = async (servicePack) => {
    let _scope = _private.get(this);
    let serviceName = servicePack.name;
    console.info(`SERVICEPACK ${serviceName}`, Date.now());
    await utils.unpackService(servicePack);

    let service = ServicePackCollection.findOne( {'name':serviceName});
    if(!service) {
        ServicePackCollection.insert({'name':serviceName, executor : _scope.executor.toJSON()});
        service = ServicePackCollection.findOne( {'name':serviceName});
    }
    service.packed = Date.now();
    ServicePackCollection.update(service);
    _scope.executor.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.SERVICE_PACK_FINISH, service);
};

let serviceCompileHandler = async (serviceName) => {
    let _scope = _private.get(this);
    console.info(`SERVICECOMPILE ${serviceName}`, Date.now());
    await utils.npmInstallService(serviceName);

    let service = ServicePackCollection.findOne( {'name':serviceName, packed: true});
    if(!service || !service.packed) {
        this.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.NOTIFY, { status: 404, error: `Service ${name} is not packed on executor ${this.getId()}`});
    }
    service.compiled = Date.now();
    ServicePackCollection.update(service);

    _scope.executor.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.SERVICE_COMPILE_FINISH, service);
};

let serviceUpHandler = async (runnerConfig) => {
    let _scope = _private.get(this);
    let executor = _scope.executor;

    let {name, qty} = runnerConfig;
    let service = ServicePackCollection.findOne( {'name':name, compiled: true });
    if(!service || !service.compiled) {
        // ** if we don't have compiled service lets just notify dns
        this.tickLayer(LAYERS.DNS, EVENTS.EXECUTOR.NOTIFY, { status: 404, error: `Service ${name} is not compiled on executor ${this.getId()}`});
    }

    console.info(`SERVICE.RUN ${name}`);
    let serviceIdentity = uuid.v4();
    let executorId = executor.getId();
    let executorHost = executor.getAddress();
    let forkArgs = ['--kitoo::sid', serviceIdentity, '--kitoo::exid', executorId, '--kitoo::exhost', executorHost];
    console.info(`Forking service ${name} on executor ${executorId}, service identity: ${serviceIdentity}`);
    let serviceProcess = childProcess.fork(name, forkArgs, { env: process.env, cwd: servicePath, shell : true });
    _scope.serviceProcessMap[serviceIdentity] = serviceProcess;
};

let serviceDownHandler = async (downgradeConfig) => {

};