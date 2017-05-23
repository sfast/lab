/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore';
import uuid from 'uuid';
import loki from 'lokijs';
import Node from 'nodik-zmq';

import globals from './globals';

let db = new loki('./db/kitoo.json');
let RouterCollection = db.addCollection('service-routers', {unique: ['id', 'name']});

let {EVENTS,LAYER} = globals;
let _private = new WeakMap();

export default class Service extends Node {
      constructor(data = {}) {
          let {service, executor, host, layer} = data;
          super({layer: layer});
          // ** When creating service we are passing executorId and host via shell

           let _scope = {};

           let _onConnect = async () => {

                let handlers = {};
                for (let name of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
                    let method = this[name];
                    // Supposedly you'd like to skip constructor
                    if (!(method instanceof Function) || method === Service || name === 'constructor') continue;
                    handlers[name] = method;
                }

                Object.keys(handlers).forEach((fnName) => {
                    let handlerFn = handlers[fnName];
                    if(_.isFunction(handlerFn)) {
                        this.onTick(fnName, this::handlerFn);
                    }
                }, this);

                // ** Attach handlers
                this::attachHandlers();
                _scope = {  id: ['service', service, uuid.v4()].join('::'),
                            name : service,
                            layer: this.getLayer(),
                            executorId : executor,
                            executorHost : host,
                            status: 'online',
                            started: Date.now(),
                            handlers : handlers
                };

               _private.set(this, _scope);

                this.tick(_scope.executorId, EVENTS.SERVICE.START, this.toJSON());
           };

           super.connect(host)
              .then(_onConnect)
              .catch( (err) => {
                  _scope.status = 'offline';
                  _scope.error = err;
                  _private.set(this, _scope);
              });

           console.log(`Service ${service} started`);
    }

    toJSON() {
        let _scope = _private.get(this);
        return {
            id: _scope.id,
            name : _scope.name,
            layer: _scope.layer,
            executorId: _scope.executorId,
            executorHost: _scope.executorHost,
            status: _scope.status,
            started: _scope.started
        };
    }

    async stop() {
        let _scope = _private.get(this);
        let handlers = _scope.handlers;

        handlers.keys().forEach((fnName) => {
            let handlerFn = handlers[fnName];
            _scope.offTick(fnName);
            _scope.offRequest(fnName);
        });

        this::detachHandlers();
        _scope.status = 'offline';
        return  this.disconnect(_scope.executorHost);

    }

    getIdentity() {
        let _scope = _private.get(this);
        return _scope.id;
    }

    getExecutorId () {
        let _scope = _private.get(this);
        return _scope.executorId;
    }

    getName() {
        let _scope = _private.get(this);
        return _scope.name;
    }
}

let attachHandlers = async () => {
    this.onTick(EVENTS.DNS.ROUTER_START, this::routerStartHandler);
    this.onTick(EVENTS.DNS.ROUTER_STOP, this::routerStopdHandler);
    this.onTick(EVENTS.DNS.ROUTER_FAIL, this::routerFailHandler);
};

let detachHandlers = async () => {
    this.offTick(EVENTS.DNS.ROUTER_START, this::routerStartHandler);
    this.offTick(EVENTS.DNS.ROUTER_STOP, this::routerStopdHandler);
    this.offTick(EVENTS.DNS.ROUTER_FAIL, this::routerFailHandler);
};

let routerStartHandler = async () => {

};

let routerStopdHandler = async () => {

};

let routerFailHandler = async () => {

};