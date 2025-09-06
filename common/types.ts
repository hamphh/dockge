export type StatsData = {
    cpuPerc: string,
    memUsage: string,
    memPerc: string,
    netIO: string,
    blockIO: string
}

export type ServiceData = {
    name: string,
    containerName: string,
    image: string,
    state: string,
    status: string,
    health: string,
    recreateNecessary: boolean,
    imageUpdateAvailable: boolean,
    remoteImageDigest: string,
    stats: StatsData | undefined
}

export type SimpleStackData = {
    name: string,
    status: number,
    started: boolean,
    recreateNecessary: boolean,
    imageUpdatesAvailable: boolean,
    tags: string[],
    isManagedByDockge: boolean,
    composeFileName: string,
    endpoint: string
}

export type StackData = SimpleStackData & {
    composeYAML: string,
    composeENV: string,
    primaryHostname: string,
    services: Record<string, ServiceData>
}
