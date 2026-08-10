import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Queue } from 'bull'
import { Model } from 'mongoose'
import * as apps from 'src/apps'

import { FormModel, IntegrationModel, IntegrationStatusEnum } from '@model'

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(IntegrationModel.name)
    private readonly integrationModel: Model<IntegrationModel>,
    @InjectQueue('IntegrationQueue') private readonly integrationQueue: Queue,
    @InjectQueue('SubmissionNotificationQueue') private readonly submissionNotificationQueue: Queue
  ) {}

  async findById(id: string): Promise<IntegrationModel | null> {
    return this.integrationModel.findById(id)
  }

  async findAllInForm(formId: string): Promise<IntegrationModel[]> {
    return this.integrationModel.find({ formId })
  }

  async findAllInFormByApps(formId: string, appIds: string[]): Promise<IntegrationModel[]> {
    return this.integrationModel.find({
      formId,
      appId: {
        $in: appIds
      }
    })
  }

  async findOne(formId: string, appId: string): Promise<IntegrationModel | null> {
    return this.integrationModel.findOne({
      formId,
      appId
    })
  }

  async create(integration: IntegrationModel | any): Promise<string | undefined> {
    const result = await this.integrationModel.create(integration as any)
    return result.id
  }

  async update(id: string, updates: Record<string, any>): Promise<any> {
    const result = await this.integrationModel.updateOne(
      {
        _id: id
      },
      updates
    )
    return result.acknowledged
  }

  async updateAllBy(conditions: Record<string, any>, updates: Record<string, any>): Promise<any> {
    const result = await this.integrationModel.updateMany(conditions, updates)
    return result.matchedCount > 0
  }

  async createOrUpdate(
    formId: string,
    appId: string,
    updates: Partial<IntegrationModel>
  ): Promise<string> {
    const integration = await this.findOne(formId, appId)

    if (integration) {
      await this.update(integration.id, updates)
      return integration.id
    }

    return this.create({
      formId,
      appId,
      ...updates
    })
  }

  public async delete(formId: string, appId: string): Promise<boolean> {
    const result = await this.integrationModel.deleteOne({
      formId,
      appId
    })
    return (result.deletedCount ?? 0) > 0
  }

  public async addQueue(form: FormModel, submissionId: string, delayMs?: number): Promise<void> {
    const jobOpts = delayMs ? { delay: delayMs, jobId: `otp-deferred:${submissionId}` } : undefined

    // Email notification Queue
    if ((form.settings as any)?.enableEmailNotification) {
      this.submissionNotificationQueue.add({
        formId: form.id,
        submissionId
      }, jobOpts)
    }

    const integrations = await this.integrationModel.find({
      formId: form.id,
      status: IntegrationStatusEnum.ACTIVE
    })

    for (const integration of integrations) {
      const app = apps[integration.appId]

      if (app) {
        this.integrationQueue.add({
          appId: integration.appId,
          formId: form.id,
          integrationId: integration.id,
          submissionId
        }, jobOpts ? { delay: delayMs, jobId: `otp-deferred:${submissionId}:${integration.id}` } : undefined)
      }
    }
  }

  public async cancelDelayedJobs(submissionId: string): Promise<void> {
    const queues = [this.integrationQueue, this.submissionNotificationQueue]
    for (const queue of queues) {
      const delayed = await queue.getDelayed()
      for (const job of delayed) {
        if (String(job.opts?.jobId || '').startsWith(`otp-deferred:${submissionId}`)) {
          await job.remove()
        }
      }
    }
  }
}
