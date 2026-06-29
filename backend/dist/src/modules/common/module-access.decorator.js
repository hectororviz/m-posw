"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireModule = exports.MODULE_ACCESS_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.MODULE_ACCESS_KEY = 'moduleAccess';
const RequireModule = (module, minAccess) => (0, common_1.SetMetadata)(exports.MODULE_ACCESS_KEY, { module, minAccess });
exports.RequireModule = RequireModule;
