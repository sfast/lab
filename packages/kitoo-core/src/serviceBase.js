/**
 * Created by artak on 2/22/17.
 */

import shortid from 'shortid'
import Node from 'zeronode'
import _ from 'underscore'

let _private = new WeakMap();

export default class ServiceBase extends Node {

    constructor({name, bind, options = {}, id = `service::${shortid.generate()}`}={}) {

        // ** When creating service we are passing executorId and host via shell

        options = Object.assign(options, {serviceName: name});
        super({id, bind, options});

        this.logger.info("Service constructor", {id});

        let _scope = {
            created: Date.now(),
            started: null,
            stoped : null,
            status : 'constructor',
        };

        _private.set(this, _scope)
    }

    start() {
        let _scope = _private.get(this);

        _scope.started = Date.now();
        _scope.status = 'online';

        this.logger.info(`Service ${_scope.id} initialized`)
    }

    async stop() {
        await super.stop();
        let _scope = _private.get(this);

        _scope.status = 'offline';
        _scope.stoped = Date.now();
    }

    toJSON() {
        let _scope = _private.get(this);
        let options = this.getOptions();
        return {
            id: this.getId(),
            options,
            name: options.serviceName,
            created: _scope.created,
            started: _scope.started,
            stoped: _scope.stoped,
            status: _scope.status
        };
    }

    getStatus() {
        let _scope = _private.get(this);
        return _scope.status
    }

    getName() {
        let options = this.getOptions();
        if (_.has(options, 'serviceName')) {
            return options.serviceName
        }
    }
}