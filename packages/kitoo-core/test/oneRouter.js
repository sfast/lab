/**
 * Created by root on 7/25/17.
 */
import { assert } from 'chai'

import { Router, Network, EVENTS, Errors} from '../src'

describe ('singleRouter', () => {
    let router, service1, service2;

    beforeEach(async () => {
        try {
            router = new Router({bind: 'tcp://127.0.0.1:8000'});
            service1 = new Network({name: 'foo', routers: [router.getAddress()]});
            service2 = new Network({name: 'bar', routers: [router.getAddress()]});
            await router.start();
            await service1.start();
            await service2.start();
        } catch (err) {
            console.log(err);
        }
    });

    afterEach(async () => {
        try {
            await service1.stop();
            await service2.stop();
            await router.stop();
        } catch(err) {
            console.log(err);
        }
    });

    it('tick To Service With Id', (done) => {
        let data = {foo: 'bar'};
        service1.onTick('foobar', (msg) => {
           assert.deepEqual(msg, data);
           done()
        });
        service2.proxyTick({ to: service1.getId(), event: 'foobar', data });
    });

    it('request To Service With Id Timeout', (done) => {
        let data = {foo: 'bar'};
        service1.onRequest('foobar', (msg) => {
            assert.deepEqual(msg.body, data);
        });
        service2.proxyRequest({ to: service1.getId(), event: 'foobar', data, timeout: 500 })
            .catch(err => {
                assert.include(err.message, 'timeout');
                done();
            })
    });

    it('request Service With Id Reply', (done) => {
        let data = {foo: 'bar'};
        service1.onRequest('foobar', (msg) => {
            assert.deepEqual(msg.body, data);
            msg.reply(data);
        });
        service2.proxyRequest({ to: service1.getId(), event: 'foobar', data })
            .then(msg => {
                assert.deepEqual(msg, data);
                done();
            })
    });

    it('tick Any Service', (done) => {
        let data = {foo: 'bar'};
        service1.onTick('foobar', (msg) => {
            assert.deepEqual(msg, data);
            done()
        });
        service2.getService(service1.getName()).tickAny({ event: 'foobar', data });
    });

    it('request Any Service Timeout', (done) => {
        let data = {foo: 'bar'};
        service1.onRequest('foobar', (msg) => {
            assert.deepEqual(msg.body, data);
        });
        service2.getService(service1.getName()).requestAny({ event: 'foobar', data, timeout: 500 })
            .catch(err => {
                assert.include(err.message, 'timeout');
                done();
            })
    });

    it('request Any Service Reply', (done) => {
        let data = {foo: 'bar'};
        service1.onRequest('foobar', (msg) => {
            assert.deepEqual(msg.body, data);
            msg.reply(data);
        });
        service2.getService(service1.getName()).requestAny({ event: 'foobar', data })
            .then(msg => {
                assert.deepEqual(msg, data);
                done();
            })
    });

    it('tick all Services', (done) => {
        let data = {foo: 'bar'};
        service1.onTick('foobar', (msg) => {
            assert.deepEqual(msg, data);
            done()
        });
        service2.getService(service1.getName()).tickAll({ event: 'foobar', data });
    });

    it('pattern listeners', (done) => {
        let data = {foo: 'bar'};
        service1.onTick(/^foo/, (msg) => {
            assert.deepEqual(msg, data);
            done()
        });
        service2.getService(service1.getName()).tickAny({ event: 'foobar', data });
    });

    it('pattern filters', (done) => {
        let data = {foo: 'bar'};
        service1.onTick('foobar', (msg) => {
            assert.deepEqual(msg, data);
            done()
        });
        service2.proxyTickAny({ event: 'foobar', data, filter: {serviceName: /^foo/} });
    })
});