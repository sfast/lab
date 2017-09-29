/**
 * Created by artak on 2/22/17.
 */

import _ from 'underscore'
import {NodeEvents, ErrorCodes} from 'zeronode'
import shortid from 'shortid'
import Promise from 'bluebird'

import globals from './globals'
import ServiceBase from './serviceBase'
import {getStorageInstance, collections} from './storage'
import Errors from './errors'
import {serializeObject} from './utils'

let {EVENTS} = globals;
let storage = getStorageInstance();

export default class NetworkService extends ServiceBase {
    constructor({id = `network::${shortid.generate()}`, name, routers = [], options} =  {}) {

        super({id, name, options});

        _.each(routers, (router) => {
            storage.insert(collections.ROUTERS, {address: router, connected: false, networkId: this.getId()})
        });

        //router failure listener
        this.on(NodeEvents.SERVER_FAILURE, this::_routerFailureHandler);

        //router stop listner
        this.on(NodeEvents.SERVER_STOP, this::_routerStopHandler)
    }

    async connect(routerAddress) {
        if (this.getStatus() != 'online') {
            throw 'you first need to start network service then start connect to routers'
        }
        let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()});
        if (!router) {
            router = this.addRouter(routerAddress)
        }
        if (!router.connected) {
            let {options, actorId} = await super.connect(router.address);
            router.options = options;
            router.id = actorId;
            router.connected = true;
            await storage.update(collections.ROUTERS, router)
        }
        return router
    }

    async disconnect(routerAddress) {
        let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()});
        if(!router) {
            return Promise.reject('there is no router with that address')
        }
        if (!router.connected) {
            return router
        }
        await super.disconnect(router.address);
        router.connected = false;
        await storage.update(collections.ROUTERS, router);
        return router
    }

    async addRouter(routerAddress) {
        let router = await storage.findOne(collections.ROUTERS, {address: routerAddress, networkId: this.getId()});
        if (!router) {
            router = await storage.insert(collections.ROUTERS, {address: routerAddress, connected: false, networkId: this.getId()})
        }
        return router
    }

    async removeRouter(routerAddress) {
        let router = await storage.find(collections.ROUTERS, {address: routerAddress, networkId: this.getId()});
        if (!router) {
            return
        }
        if (router.connected) {
            router = await this.disconnect(router.address)
        }
        await storage.remove(collections.ROUTERS, router)
    }

    //
    toJSON() {
        //add routersInfo
        return super.toJSON()
    }

    async start() {
        if (this.getStatus() == 'online') {
            return
        }
        super.start();
        let connectionPromises = _.map(await storage.find(collections.ROUTERS, {networkId: this.getId()}), (router) => {
            return this.connect(router.address)
        });
        await Promise.all(connectionPromises);
        this.onTick(EVENTS.NETWORK.NEW_ROUTER, this::_newRouterHandler)
    }

    async stop() {
        this.tickAll(EVENTS.NETWORK.STOP, this.getOptions());
        await super.stop();
        this.offTick(EVENTS.NETWORK.NEW_ROUTER)
    }

    proxyTick (id, event, data) {
        try {
            this.tickAny(EVENTS.ROUTER.MESSAGE, {
                type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO,
                id,
                event,
                data
            })
        } catch (err) {
            if (err.code == ErrorCodes.NO_NODE) {
                throw {code: Errors.NO_ONLINE_ROUTER, message: 'there is no online router'}
            }
        }
    }

    proxyTickAny(event, data, filter = {}) {
        try {
            filter = serializeObject(filter);
            this.tickAny(EVENTS.ROUTER.MESSAGE, {
                type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY,
                event,
                data,
                filter
            })
        } catch (err) {
            if (err.code == ErrorCodes.NO_NODE) {
                throw {code: Errors.NO_ONLINE_ROUTER, message: 'there is no online router'}
            }
        }
    }

    proxyTickAll(event, data, filter = {}) {
        try {
            filter = serializeObject(filter)
            this.tickAny(EVENTS.ROUTER.MESSAGE, {
                type: EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST,
                event,
                data,
                filter
            })
        } catch (err) {
            if (err.code == ErrorCodes.NO_NODE) {
                throw {code: Errors.NO_ONLINE_ROUTER, message: 'there is no online router'}
            }
        }
    }

    async proxyRequestAny(event, data, timeout = 5000, filter = {}) {
        try {
            filter = serializeObject(filter);
            return await this.requestAny(EVENTS.ROUTER.MESSAGE, {
                type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY,
                event,
                data,
                timeout,
                filter
            }, timeout)
        } catch (err) {
            if (err.code == ErrorCodes.NO_NODE) {
                throw {code: Errors.NO_ONLINE_ROUTER, message: 'there is no online router'}
            }
            throw err;
        }
    }

    async proxyRequest(id, event, data, timeout = 5000) {
        try {
            return await this.requestAny(EVENTS.ROUTER.MESSAGE, {
                type: EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO,
                id,
                event,
                data,
                timeout
            }, timeout)
        } catch (err) {
            if (err.code == ErrorCodes.NO_NODE) {
                throw {code: Errors.NO_ONLINE_ROUTER, message: 'there is no online router'}
            }
            throw err;
        }
    }

    getService(serviceName) {
        let self = this;
        return {
            tickAny: (event, data) => {
                self.proxyTickAny(event, data, {serviceName})
            },
            tickAll: (event, data) => {
                self.proxyTickAll(event, data, {serviceName})
            },
            requestAny: async (event, data, timeout) => {
                return await self.proxyRequestAny(event, data, timeout, {serviceName})
            }
        }
    }
}

async function _newRouterHandler(routerAddress) {
    try {
        await this.connect(routerAddress);
        this.logger.info(`new router with address - ${routerAddress}`)
    } catch (err) {
        this.logger.error(`error while handling new router: ${err}`)
    }
}

async function _routerStopHandler(routerInfo) {
    try {
        await this.disconnect(routerInfo.address);
        this.logger.info(`router stop with address/id - ${routerInfo.address}/${routerInfo.id}`)
    } catch (err) {
        this.logger.error(`error while disconnecting stop router ${err}`)
    }
}

async function _routerFailureHandler(routerInfo) {
    try {
        console.log('router fail', routerInfo);
        await this.removeRouter(routerInfo.address);
        this.logger.info(`router failed with address/id - ${routerInfo.address}/${routerInfo.id}`)
    } catch (err) {
        this.logger.error(`error while disconnecting failed router ${err}`)
    }
}