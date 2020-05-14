import {
    DiagnosticSeverity,
    DocumentLanguageSettings,
    ASTNode,
    ObjectASTNode,
    PropertyASTNode,
    getLanguageService,
    TextDocument as ASLTextDocument,
} from 'amazon-states-language-service'

import * as vscode from 'vscode'
const languageService = getLanguageService({})

interface IStateMachineData {
    name: string
    definition: string
    range: vscode.Range
}

export function isObjectNode(node?: ASTNode): node is ObjectASTNode {
    return node?.type === 'object'
}

export default function extractStateMachinesFromCfTemplate(textDocument: vscode.TextDocument): IStateMachineData[] {
    const text = textDocument.getText()
    const doc = ASLTextDocument.create(textDocument.uri.path, textDocument.languageId, textDocument.version, text)
    // tslint:disable-next-line: no-inferred-empty-object-type
    const jsonDocument = languageService.parseJSONDocument(doc) as { root?: ASTNode }

    if (isObjectNode(jsonDocument.root)) {
        const resources = jsonDocument?.root?.properties?.find(prop => {
            return prop.keyNode.value === 'Resources'
        })?.valueNode

        if (isObjectNode(resources)) {
            const stateMachineNodes = resources.properties.filter(resourceProperty => {
                const resourceValueNode = resourceProperty.valueNode

                if (isObjectNode(resourceValueNode)) {
                    const stateMachine = resourceValueNode.properties.find(item => {
                        const isTypeProp = item.keyNode.value === 'Type'
                        const isStateMachineValue = item.valueNode?.value === 'AWS::Serverless::StateMachine'

                        return isTypeProp && isStateMachineValue
                    })

                    return !!stateMachine
                }

                return false
            })

            return stateMachineNodes.map(stateMachineNode => {
                const { offset, colonOffset } = stateMachineNode

                const startPos = textDocument.positionAt(offset)
                const endPos = textDocument.positionAt(offset + colonOffset!)

                return {
                    definition: '',
                    name: stateMachineNode.keyNode.value,
                    range: new vscode.Range(startPos, endPos),
                }
            })
        }
    }

    return []
}
