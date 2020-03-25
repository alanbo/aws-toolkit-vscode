/*!
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */

import * as fs from 'fs'
// tslint:disable-next-line:no-implicit-dependencies
import { JSONSchema4 } from 'json-schema'
import { compile } from 'json-schema-to-typescript'
import * as packageJson from '../package.json'

const config = [
    {
        debugger: 'aws-sam',
        requestType: 'direct-invoke' as 'direct-invoke',
        outputFile: 'src/shared/sam/debugger/awsSamDebugConfiguration.gen.ts',
        imports: ["import * as vscode from 'vscode'"],
        topLevelClass: 'AwsSamDebuggerConfiguration'
    }
]

const header = `
/* tslint:disable */
/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

import * as vscode from 'vscode'
`

async function generateConfigurationAttributes(): Promise<void> {
    for (const debugConfiguration of packageJson.contributes.debuggers) {
        const debuggerConfig = config.find(cfg => {
            return cfg.debugger === debugConfiguration.type
        })
        if (debuggerConfig === undefined) {
            continue
        }
        const schema = debugConfiguration.configurationAttributes[debuggerConfig.requestType] as JSONSchema4
        await compile(schema, 'DirectInvoke', { bannerComment: header })
            .then(ts => addBaseClass(ts, debuggerConfig.topLevelClass))
            .then(ts => fs.writeFileSync(debuggerConfig.outputFile, ts))
    }
}

function addBaseClass(generated: string, topLevelClass: string): string {
    return generated.replace(topLevelClass, `${topLevelClass} extends vscode.DebugConfiguration`)
}

// tslint:disable-next-line:no-floating-promises
;(async () => {
    await generateConfigurationAttributes()
})()
