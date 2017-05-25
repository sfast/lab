import fse from 'fs-extra';
import path from 'path';

let _config = null;

let defaultConf = {
    "dir" : "./kitoos",
    "any" : 1
};


export default async () => {
    if(!_config) {
        let rootConf, defaultConf = {};
        let rootConfigPath = path.resolve(`./kitoo.json`);

        let rootConfigExists = await fse.pathExists(rootConfigPath);

        if(rootConfigExists) {
            rootConf = await fse.readJson(rootConfigPath);
        }

        _config = Object.assign(defaultConf, rootConf);
    }


    return _config;
};