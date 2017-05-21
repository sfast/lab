import fse from 'fs-extra';
import path from 'path';

let _config = null;

export default async () => {
    if(!_config) {
        let rootConf, defaultConf = {};
        let rootConfigPath = path.resolve(`./kitoo.json`);

        let rootConfigExists = await fse.pathExists(rootConfigPath);

        if(rootConfigExists) {
            rootConf = await fse.readJson(rootConfigPath);
        }

        let defaultConfigPath = path.resolve(`${__dirname}/kitoo.json`);
        let defaultConfigExists = await fse.pathExists(defaultConfigPath);

        if(defaultConfigExists) {
            defaultConf = await fse.readJson(defaultConfigPath);
        }

        _config = Object.assign(defaultConf, rootConf);
    }


    return _config;
};