import { ResultContainer } from "./treeViewProvider";

export function analyzeMatchResults(rootContainer: ResultContainer): Map<string, number>{
    const resultMap = new Map<string, number>([]);
    
    const fillResultMap = (currentContainer: ResultContainer) => {
        for(const container of currentContainer.results){
            if(!container.isFile){
                fillResultMap(container);
            }
            resultMap.set(container.label, container.results.length);
        }
    };

    fillResultMap(rootContainer);
    return resultMap;
}