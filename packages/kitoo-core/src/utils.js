/**
 * Created by root on 8/2/17.
 */
import _ from 'underscore'

export function serializeObject(obj) {
    obj = Object.assign({}, obj);
    _.each(obj, (value, key) => {
        if (value instanceof RegExp) {
            obj[key] = {
                type: 'RegExp',
                value: value.source
            }
        }
    });
    return obj;
}

export function deserializeObject(obj) {
    obj = Object.assign({}, obj);
    _.each(obj, (value, key) => {
        if (typeof value == 'object' && value.type == 'RegExp') {
            obj[key] = new RegExp(value.value);
        }
    });
    return obj;
}