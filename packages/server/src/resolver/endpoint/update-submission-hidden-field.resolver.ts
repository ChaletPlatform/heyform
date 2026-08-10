import { BadRequestException, UseGuards } from '@nestjs/common'

import { UpdateSubmissionHiddenFieldInput } from '@graphql'
import { EndpointAnonymousIdGuard } from '@guard'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { FormService, IntegrationService, SubmissionService } from '@service'

@Resolver()
@UseGuards(EndpointAnonymousIdGuard)
export class UpdateSubmissionHiddenFieldResolver {
  constructor(
    private readonly formService: FormService,
    private readonly submissionService: SubmissionService,
    private readonly integrationService: IntegrationService
  ) {}

  @Mutation(returns => Boolean)
  async updateSubmissionHiddenField(
    @Args('input') input: UpdateSubmissionHiddenFieldInput
  ): Promise<boolean> {
    const submission = await this.submissionService.findByFormId(input.formId, input.submissionId)

    if (!submission) {
      throw new BadRequestException('The submission does not exist')
    }

    const fieldExists = submission.hiddenFields?.some(f => f.name === input.fieldName)
    if (!fieldExists) {
      throw new BadRequestException('The hidden field does not exist on this submission')
    }

    const updated = await this.submissionService.updateHiddenField(
      input.submissionId,
      input.fieldName,
      input.value
    )

    if (!updated) {
      throw new BadRequestException('Failed to update hidden field')
    }

    // Cancel the delayed Bull job and fire the webhook immediately with the updated value
    await this.integrationService.cancelDelayedJobs(input.submissionId)

    const form = await this.formService.findById(input.formId)
    if (form) {
      await this.integrationService.addQueue(form, input.submissionId)
    }

    return true
  }
}
