## About
kitoo-core is service based on [zeronode](https://github.com/sfast/zeronode), for creating server to server communication.
It has 2 service types. Network and Router, and one abstract Service.

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