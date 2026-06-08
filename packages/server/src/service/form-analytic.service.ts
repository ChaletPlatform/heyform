import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { SubmissionService } from './submission.service'
import { date, helper } from '@heyform-inc/utils'
import { FormAnalyticModel } from '@model'

interface FormAnalyticOptions {
  formId: string
  startAt: Date
  endAt: Date
  isNext?: boolean
}

interface FormAnalyticResult {
  totalVisits: number
  submissionCount: number
  averageTime: number
}

@Injectable()
export class FormAnalyticService {
  constructor(
    @InjectModel(FormAnalyticModel.name)
    private readonly formAnalyticModel: Model<FormAnalyticModel>,
    private readonly submissionService: SubmissionService
  ) {}

  public async summary({ formId, startAt, endAt, isNext }: FormAnalyticOptions) {
    const [totalVisits, result] = await Promise.all([
      this.getTotalVisits(formId, startAt, endAt),
      this.submissionService.analytic(
        formId,
        Math.floor(startAt.getTime() / 1000),
        Math.floor(endAt.getTime() / 1000)
      )
    ])

    const analytic = {
      totalVisits: 0,
      submissionCount: 0,
      averageTime: 0
    }

    if (totalVisits > 0) {
      analytic.totalVisits = totalVisits

      if (helper.isValidArray(result)) {
        analytic.submissionCount = result[0].submissionCount
        analytic.averageTime = result[0].averageTime
      }

      return analytic
    } else if (isNext) {
      return analytic
    } else {
      return {} as FormAnalyticResult
    }
  }

  public async getTotalVisits(formId: string, startAt: Date, endAt: Date): Promise<number> {
    const result = await this.formAnalyticModel.aggregate([
      {
        $match: {
          formId,
          createdAt: {
            $gte: startAt,
            $lte: endAt
          }
        }
      },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: '$totalVisits' }
        }
      }
    ])

    return result[0]?.totalVisits || 0
  }

  public async updateTotalVisits(formId: string): Promise<void> {
    const formAnalytic = await this.findFormAnalyticInToday(formId)

    if (formAnalytic) {
      await this.formAnalyticModel.updateOne(
        {
          _id: formAnalytic.id
        },
        {
          $inc: {
            totalVisits: 1
          }
        }
      )
    } else {
      await this.formAnalyticModel.create({
        formId,
        totalVisits: 1
      } as any)
    }
  }

  private async findFormAnalyticInToday(formId: string): Promise<FormAnalyticModel> {
    const today = date()

    return this.formAnalyticModel.findOne({
      formId,
      createdAt: {
        $gte: today.startOf('day'),
        $lte: today.endOf('day')
      }
    })
  }

  public async delete(formId: string | string[]): Promise<boolean> {
    let result: any

    if (helper.isValidArray(formId)) {
      result = await this.formAnalyticModel.deleteMany({
        formId: {
          $in: formId as string[]
        }
      })
    } else {
      result = await this.formAnalyticModel.deleteOne({
        formId: formId as string
      })
    }

    return (result.deletedCount ?? 0) > 0
  }
}
