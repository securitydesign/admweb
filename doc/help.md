# ADM

## General structure

The simplest of the models have a model title, one or more `Attack:` blocks and one or more `Defense:` blocks.

```
 Model: [Model Title]
    Attack: [Attack Title]
        Given [precondition statement]
        When [action statement]
        Then [expected result statement]
    Defense: [Defense Title]
        Given [precondition statement]
        When [action statement]
        Then [expected result statement]
```

You can have multiple `Given`, `When` and `Then` statements by adding `And` statements after each of these section. For example -
```
Attack: [Attack Title]
    Given [precondition statement]
    And [another precondition statement]
    When [action statement]
    And [another action statement]
    Then [expected result statement]
    And [another result statement]
```

## How to connect attacks and defenses

Please note that statement matching is case-sensitive. So 'Target' in one statement will not match 'target' in another. Print the quick reference card below for understand the 4 rules of ADM.

### **Chain Rule**: Use `[title]` in `Given [precondition statement]` of another

NOTE: This rule applies only to blocks of same type i.e., attack → attack or defense → defense. To chain attacks/defenses, title of one should appear in `Given` statement of another.

```
Attack: Target is scanned
    Given target is open to Internet
    When port scan is performed on target
    Then port 22 is found to be open
Attack: SSH connection is attempted
    Given target is open to Internet
    And Target is scanned
    When SSH connection is attempted using `root/toor` credentials
    Then SSH connection is successfully established
```
![attack-attack](doc/attack-attack.png)

### **Pre-emptive defense Rule**: Use same `When [action statement]` in attack and defense
```
Attack: Target is scanned
    Given target is open to Internet
    When port scan is performed on target
    Then port 22 is found to be open
Defense: Port scanning is not allowed
    Given target is open to Internet
    When port scan is performed on target
    Then block all port scan requests
```
![pre-emptive](doc/pre-emptive.png)

### **Incident-response Rule**: Use `Then [action statement]` from attack in `When [action statement]` of defense
```
Attack: Target is scanned
    Given target is open to Internet
    When port scan is performed on target
    Then port 22 is found to be open
Defense: NOC is notified of scans
    Given target is open to Internet
    When port 22 is found to be open
    Then notify network operations of a SSH port exposed to Internet
```
![incident-response](doc/incident-response.png)

### **Defense-breaker Rule**: Use `Then [action statement]` from defense in `When [action statement]` of attack
```
Defense: Disable root account
    Given target is open to Internet
    When SSH log contains root login attempts
    Then root login is disabled
Attack: Attempt commonly used credentials
    Given target is open to Internet
    When root login is disabled
    Then other commonly used default SSH credentials are attempted
```
![defense-breaker](doc/defense-breaker.png)

### **Tag based matching**: Use the same `@[tag]` for both the attack and defense
```
@ssh
Attack: Target is scanned
    Given target is open to Internet
    When port scan is performed on target
    Then port 22 is found to be open
@ssh
Defense: Target is designed to not run SSH server
    Given target is open to Internet
    When target image is being compiled
    Then configure target to not install SSH server
```
![tag-based](doc/tag-based.png)

## Advanced topics

### Assumptions

Add an `Assumption:` block at the beginning of the model to indicate assumptions that apply to the entire model.

```
Model: Secure deployment
    Assumption: Deployment environment
        Given target is open to Internet
        And target is deployed at a cloud provider
    Attack: Target is scanned
        When port scan is performed on target
        Then port 22 is found to be open
    Defense: Port scanning is not allowed
        When port scan is performed on target
        Then block all port scan requests
```
![assumption](doc/assumption.png)

### Policy

Add a `Policy:` block at the end of the model to capture assumptions and defenses that implement a specific policy. This can be a company policy or a rule/condition you want to show as being addressed by a set of defenses.

```
Model: Secure deployment
    Assumption: Deployment environment
        Given target is open to Internet
        And target is deployed at a cloud provider
    @ssh
    Attack: Target is scanned
        When port scan is performed on target
        Then port 22 is found to be open

    Policy: System should not run unnecessary services
        Assumption: IaC used for infra design
            Given Target design is specified using Infrastructure-as-Code 
        @ssh
        Defense: Target is designed to not run SSH server
            When target image is being compiled
            Then configure target to not install SSH server
```
![policy](doc/policy.png)