/**
 * Created by artak on 2/22/17.
 */

import shortid from 'shortid'
import {NodeEvents} from 'zeronode'

import globals from './globals'
import ServiceBase from './serviceBase'
import {collections, getStorageInstance} from './storage'
import {deserializeObject} from './utils'


let {EVENTS} = globals;
let storage = getStorageInstance();

export default class RouterService extends ServiceBase {
    constructor({id = `router::${shortid.generate()}`, name, bind, options}) {

        super({id, name, bind, options});

        this.on(NodeEvents.CLIENT_CONNECTED, this::_serviceWelcomeHandler);
        this.on(NodeEvents.CLIENT_FAILURE, this::_serviceFailOrStopHandler);
        this.on(NodeEvents.CLIENT_STOP, this::_serviceFailOrStopHandler)
    }

    async start() {
        if (this.getStatus() == 'online') {
            return
        }
        super.start();
        await this.bind(this.getAddress());

        // ** PROXIES EXPECTING FROM SERVICE LAYER

        this.onTick(EVENTS.ROUTER.MESSAGE, this::_routerTickMessageHandler);
        this.onRequest(EVENTS.ROUTER.MESSAGE, this::_routerRequestMessageHandler)
    }

    async connectToExistingNetwork(routerAddress) {
        if (this.getStatus() != 'online') {
            throw 'need to start router before connecting to network';
        }

        let { actorId } = await this.connect(routerAddress);

        this.tick({ to: actorId, event: EVENTS.ROUTER.MESSAGE, data: {
            type: EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST,
            filter: {},
            event: EVENTS.NETWORK.NEW_ROUTER,
            data:this.getAddress()
        } });

        await this.disconnect(routerAddress);
    }

    async stop() {
        if (!this.getStatus()) {
            return
        }
        await super.stop();
        this.offTick(EVENTS.ROUTER.MESSAGE);
        this.offRequest(EVENTS.ROUTER.MESSAGE);
    }
}

async function _serviceWelcomeHandler({id, options}) {
    try {
        let service = await storage.findOne(collections.NETWORKS, {routerId: this.getId(), id});

        if (service) {
            service.status = true;
            return await storage.update(collections.NETWORKS, service)
        }

        return await storage.insert(collections.NETWORKS,{id, options, status: true, routerId: this.getId()})
    } catch (err) {
        this.logger.error(`error while welcoming service: ${err}`)
    }
}

async function _serviceFailOrStopHandler({id}) {
    try {
        let service = await storage.findOne(collections.NETWORKS, {routerId: this.getId(), id});
        if (!service) {
            return
        }
        service.status = false;
        await storage.update(collections.NETWORKS, service);
    } catch (err) {
        this.logger.error(`error while handling service Fail: ${err}`)
    }
}


function _routerTickMessageHandler(routeMessage) {
    try {
        let {type, id, event, data, filter} = routeMessage;
        //TODO :: some higher level checking if there is service with that filter
        switch (type) {
            case EVENTS.ROUTER.MESSAGE_TYPES.BROADCAST:
                filter = deserializeObject(filter);
                this.tickAll({ event, data, filter });
                break;
            case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY:
                filter = deserializeObject(filter);
                this.tickAny({ event, data, filter });
                break;
            case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO:
                this.tick({ to: id, event, data });
                break;
        }
    } catch (err) {
        this.logger.error(`error while handling service message:`, err)
    }
}

async function _routerRequestMessageHandler(request){
    try {
        let {body, reply} = request;
        let {type, id, event, data, timeout, filter} = body;
        let serviceResponse;
        //TODO :: some higher level checking if there is service with that filter
        switch (type) {
            case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_ANY:
                filter = deserializeObject(filter);
                serviceResponse =  await this.requestAny({ endpoint: event, data, timeout, filter });
                break;
            case EVENTS.ROUTER.MESSAGE_TYPES.EMIT_TO:
                serviceResponse =  await this.request({ to: id, endpoint: event, data, timeout });
                break;
        }
        reply(serviceResponse)
    } catch (err) {
        this.logger.error(`error while handling request message: ${err}`)
    }
}
