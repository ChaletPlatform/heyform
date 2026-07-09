import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { helper, timestamp } from '@heyform-inc/utils'
import { GqlExecutionContext } from '@nestjs/graphql'
import { FormService, ProjectService, TeamService } from '@service'
import { requestParser } from '@utils'

export enum PermissionScopeEnum {
  team = 0,
  project,
  form
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly teamService: TeamService,
    private readonly projectService: ProjectService,
    private readonly formService: FormService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let req: any
    let args: any

    if (context.getType() === 'http') {
      req = context.switchToHttp().getRequest()
      args = {
        input: {
          teamId: requestParser(req, ['teamId', 'team_id']),
          projectId: requestParser(req, ['projectId', 'project_id']),
          formId: requestParser(req, ['formId', 'form_id'])
        }
      }
    } else {
      const ctx = GqlExecutionContext.create(context)
      ;({ req } = ctx.getContext())
      args = ctx.getArgs()
    }

    const user = req.user
    const scope = this.reflector.get<PermissionScopeEnum>('scope', context.getHandler())

    if (helper.isEmpty(user)) {
      throw new UnauthorizedException('Unauthorized')
    }

    let { teamId, projectId } = args.input

    if (scope >= PermissionScopeEnum.form) {
      const formId = args.input.formId
      const form = await this.formService.findById(formId)

      if (!form) {
        throw new BadRequestException('Please make sure you have permission to access this form')
      }

      req.form = {
        id: formId,
        ...form.toObject()
      }

      teamId = form.teamId
      projectId = form.projectId
    }

    if (scope >= PermissionScopeEnum.project) {
      const project = await this.projectService.findById(projectId)

      if (!project) {
        throw new BadRequestException('Please make sure you have permission to access this project')
      }

      const member = await this.projectService.findMemberById(projectId, user.id)
      if (!member) {
        throw new BadRequestException("You don't have permission to access the workspace")
      }

      req.project = {
        id: projectId,
        ...project.toObject(),
        isOwner: project.ownerId === user.id
      }

      teamId = project.teamId
    }

    const team = await this.teamService.findById(teamId)

    if (!team) {
      throw new BadRequestException("You don't have permission to access the workspace")
    }

    const member = await this.teamService.findMemberById(teamId, user.id)
    if (!member) {
      throw new BadRequestException("You don't have permission to access the workspace")
    }

    const isOwner = team.ownerId === user.id

    req.team = {
      id: teamId,
      ownerId: team.ownerId,
      isOwner,
      name: team.name,
      role: member?.role,
      storageQuota: team.storageQuota,
      inviteCode: team.inviteCode
    }

    this.teamService.updateMember(teamId, user.id, {
      lastSeenAt: timestamp()
    })

    return true
  }
}
