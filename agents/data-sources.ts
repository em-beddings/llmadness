import path from "node:path";
import { readJsonFile } from "@/lib/fs";
import { BracketConfig, DataSourceSnapshot } from "@/lib/types";
import { DataSource } from "@/agents/interfaces";

export class StaticFileDataSource implements DataSource {
  constructor(
    public readonly id: string,
    public readonly title: string,
    private readonly filePath: string
  ) {}

  async collect(_config: BracketConfig): Promise<DataSourceSnapshot> {
    const payload = await readJsonFile<unknown>(path.join(process.cwd(), this.filePath));
    return {
      id: this.id,
      title: this.title,
      collectedAt: new Date().toISOString(),
      payload
    };
  }
}

export class DerivedTeamSnapshotDataSource implements DataSource {
  public readonly id = "team-metrics";
  public readonly title = "Seed and metric summary";

  async collect(config: BracketConfig): Promise<DataSourceSnapshot> {
    return {
      id: this.id,
      title: this.title,
      collectedAt: new Date().toISOString(),
      payload: config.teams.map((team) => ({
        id: team.id,
        name: team.name,
        seed: team.seed,
        region: team.region,
        metrics: team.metrics ?? {}
      }))
    };
  }
}
