## Kitoo-Core
* [What Is Kitoo-Core](#about)
* [How To Install](#installation)
* [API](#api)
* [CLI](#cli)
* [Examples](#examples)
* [Contributing](#contributing)
* [License](#license)

### What Is Kitoo-Core
kitoo-core is service based on [zeronode](https://github.com/sfast/zeronode), for creating server to server communication.


<a name="installation"></a>
### How To Install
For library usage.
```bash
npm install kitoo-core
```
And For kitooc-core cli usage.
```bash
npm install -g kitoo-core
```

### API
#### Basic Concepts
There is two basic concepts in kitoo-core, `Network` and `Router`. `Network` service connects to Routers and communicates to other
`Network` services through `Routers`. In other end `Routers` are just connecting together `Ntworks`.
We will call `Existing Network` to already connected `Routers` an `Networks`. So all `Routers` in `Existing Network` mus be connected to
`All Networks`.

#### Router
* [<code>**new Router()**</code>](#router)
* [<code>router.**start()**</code>](#routerStart)
* [<code>router.**stop()**</code>](#routerStop)
* [<code>router.**connectExistingNetwork()**</code>](#connectExistingNetwork)
* [<code>router.**defineLoadBalancingStrategy()**</code>](#defineLoadBalancingStrategy)
* [<code>router.**tickToService()**</code>](#tickToService)
* [<code>router.**tickAnyService()**</code>](#tickAnyService)
* [<code>router.**tickAllServices()**</code>](#tickAllServices)
* [<code>router.**requestToService()**</code>](#requestToService)
* [<code>router.**requestAnyService()**</code>](#requestAnyService)
* [<code>router.**onTick()**</code>](#routerOnTick)
* [<code>router.**offTick()**</code>](#routerOffTick)
* [<code>router.**onRequest()**</code>](#routerOnRequest)
* [<code>router.**offRequest()**</code>](#routerOffRequest)

#### Network
* [<code>**new Network()**</code>](#network)
* [<code>router.**start()**</code>](#networkStart)
* [<code>router.**stop()**</code>](#networkStop)
* [<code>router.**connectRouter()**</code>](#v)
* [<code>router.**disconnectRouter()**</code>](#defineLoadBalancingStrategy)
* [<code>router.**addRouter()**</code>](#addRouter)
* [<code>router.**removeRouter()**</code>](#removeRouter)
* [<code>router.**proxyTick()**</code>](#proxyTick)
* [<code>router.**proxyTickAny()**</code>](#proxyTickAny)
* [<code>router.**proxyTickAll()**</code>](#proxyTickAll)
* [<code>router.**proxyRequestAny()**</code>](#proxyRequestAny)
* [<code>router.**proxyRequest()**</code>](#proxyRequest)
* [<code>router.**tickToRouter()**</code>](#tickToRouter)
* [<code>router.**tickAnyRouter()**</code>](#tickAnyRouter)
* [<code>router.**tickAllRouters()**</code>](#tickAllRouters)
* [<code>router.**requestToRouter()**</code>](#requestToRouter)
* [<code>router.**requestAnyRouter()**</code>](#requestAnyRouter)
* [<code>router.**onTick()**</code>](#networkOnTick)
* [<code>router.**offTick()**</code>](#networkOffTick)
* [<code>router.**onRequest()**</code>](#networkOnRequest)
* [<code>router.**offRequest()**</code>](#networkOffRequest)
* [<code>router.**subscribe()**</code>](#subscribe)
* [<code>router.**publish()**</code>](#publish)
* [<code>router.**getRoutingInterface()**</code>](#getRoutingInterface)
* [<code>router.**getService()**</code>](#getService)

### Router Service
Router Service connects all network services to each other.

### Network Service
Network Service can send and get messages from other services.
Network Services can send messages to other Network Services via Router Service.

All network Services must be connected to All Router Services. 

## Usage Example

router.js
```javascript
import {Router} from 'kitoo-core'

(async function () {
    try {
       let router = new Router({ bind: 'tcp:://127.0.0.1:3000' });
       await router.start();
       console.log('router started')
    } catch (err) {
       console.error(err) 
    }
}());
```

service1.js
```javascript
import {Network} from 'kitoo-core'

(async function () {
    try {
        let network = new Network({name: 'foo', routers: ['tcp://127.0.0.1:3000']})
        await network.start();
        
        console.log('service1 started');
        
        network.onTick('baz', (msg) => {
            console.log('got message on baz event:', msg)
        })
    } catch (err) {
        console.error(err)
    }
}())
```

service2.js
```javascript
import {Network} from 'kitoo-core'

(async function () {
    try {
        let network = new Network({name: 'bar', routers: ['tcp://127.0.0.1:3000']})
        await network.start();
        console.log('service2 started');
        let service1 = network.getService('foo');
        service1.tickAny('baz', 'Hi service1, I am service2.')
    } catch (err) {
        console.error(err)
    }
}())
```

```bash
#terminal 1
$ babel-node router.js
router started

#terminal 2
$ babel-node service1.js
service1 started
got message on baz event: Hi service1, I am service2.

#terminal 3
$ babel-node service2.js
service2 started

```