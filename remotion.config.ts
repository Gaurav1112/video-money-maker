import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(85);
Config.setOverwriteOutput(true);
Config.setConcurrency(8);
Config.setChromiumOpenGlRenderer('angle');
