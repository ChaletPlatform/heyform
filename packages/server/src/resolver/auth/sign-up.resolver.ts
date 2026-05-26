import { BadRequestException, UseGuards } from '@nestjs/common'

import { GraphqlResponse } from '@decorator'
import { ALLOWED_EMAIL_DOMAINS, APP_DISABLE_REGISTRATION, BCRYPT_SALT } from '@environments'
import { SignUpInput } from '@graphql'
import { DeviceIdGuard } from '@guard'
import { helper } from '@heyform-inc/utils'
import { UserActivityKindEnum } from '@model'
import { Args, Mutation, Resolver } from '@nestjs/graphql'
import { AuthService, MailService, UserService } from '@service'
import { ClientInfo, GqlClient, gravatar, passwordHash } from '@utils'
import { isDisposableEmail } from '@utils'

@Resolver()
@UseGuards(DeviceIdGuard)
export class SignUpResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly mailService: MailService
  ) {}

  @Mutation(returns => Boolean)
  async signUp(
    @GqlClient() client: ClientInfo,
    @GraphqlResponse() res: any,
    @Args('input') input: SignUpInput
  ): Promise<boolean> {
    if (APP_DISABLE_REGISTRATION) {
      throw new BadRequestException('Error: Registration is disabled')
    }

    if (isDisposableEmail(input.email)) {
      throw new BadRequestException(
        'Error: Disposable email address detected, please use a work email to create the account'
      )
    }

    if (ALLOWED_EMAIL_DOMAINS.length > 0) {
      const domain = input.email.split('@')[1]?.toLowerCase()
      if (!domain || !ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        throw new BadRequestException('Error: Registration is restricted to authorized email domains')
      }
    }

    const existUser = await this.userService.findByEmail(input.email)

    if (helper.isValid(existUser)) {
      throw new BadRequestException('The email address already exist')
    }

    const userId = await this.userService.create({
      name: input.name,
      email: input.email,
      password: await passwordHash(input.password, BCRYPT_SALT),
      avatar: gravatar(input.email),
      lang: client.lang
    })

    this.authService.createUserActivity({
      kind: UserActivityKindEnum.SIGN_UP,
      userId,
      ...client
    })

    await this.authService.login({
      res,
      userId,
      deviceId: client.deviceId
    })

    const code = await this.authService.getVerificationCodeWithRateLimit(`verify_email:${userId}`)
    this.mailService.emailVerificationRequest(input.email, code)

    return true
  }
}
